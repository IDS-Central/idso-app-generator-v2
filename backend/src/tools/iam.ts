/**
 * IAM write-tool handler(s).
 *
 * Implements `iam_create_sa`: creates a per-app runtime service account
 * named `idso-<app_name>-runtime@<project>.iam.gserviceaccount.com` and
 * grants it EXACTLY three project-level roles:
 *   - roles/bigquery.dataViewer
 *   - roles/bigquery.jobUser
 *   - roles/logging.logWriter (required for Cloud Build trigger execution)
 *
* No other roles are ever attached by this handler. If either role is
 * already granted (or the SA already exists), the operation is idempotent
 * and returns ok.
 */

import { google } from 'googleapis';
import type { IamClient, ToolHandler } from './types.js';
import { ok, err } from './types.js';

/* -------------------- client construction -------------------- */

/**
 * Build an IamClient using Application Default Credentials.
 * On Cloud Run this picks up the service's attached SA automatically.
 */
export async function buildIamClient(projectId: string): Promise<IamClient> {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const authClient = await auth.getClient();
  const iam = google.iam({ version: 'v1', auth: authClient as never });
  const crm = google.cloudresourcemanager({ version: 'v1', auth: authClient as never });
  return { iam, crm, projectId };
}

/* -------------------- retry helper -------------------- */

/**
 * Retry wrapper for setIamPolicy. Handles two failure modes:
 *   1. Eventual consistency of a freshly-created SA: setIamPolicy may
 *      reject the member with HTTP 400 "does not exist" for a few
 *      seconds after serviceAccounts.create returns success.
 *   2. ETag conflicts (HTTP 409): another writer beat us to setIamPolicy
 *      between our get and set; re-read and re-apply.
 *
 * On retryable errors we re-read the policy and re-apply the mutation.
 * Non-retryable errors bubble up.
 */
async function withIamPolicyRetry<T>(
  attempt: (attemptNum: number) => Promise<T>,
  log: { info: (o: object, m: string) => void; warn: (o: object, m: string) => void },
  maxAttempts = 5,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      return await attempt(i);
    } catch (e: unknown) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const status =
        (e as { code?: number; status?: number })?.code ??
        (e as { code?: number; status?: number })?.status;
      const isMemberNotReady = /does not exist|is not a valid|not found/i.test(msg);
      const isEtagConflict = status === 409 || /etag|concurren/i.test(msg);
      const retryable = isMemberNotReady || isEtagConflict;
      if (!retryable || i === maxAttempts) {
        throw e;
      }
      const backoffMs = Math.min(8_000, 500 * Math.pow(2, i - 1));
      log.warn(
        { event: 'iam_set_policy_retry', attempt: i, status, err: msg, backoff_ms: backoffMs },
        'retrying setIamPolicy after transient error',
      );
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastErr;
}

/* -------------------- handler -------------------- */

const APP_NAME_RE = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/;
const RUNTIME_ROLES = [
  'roles/bigquery.dataViewer',
  'roles/bigquery.jobUser',
  // logWriter is required for the SA to be usable as the identity of a
  // Cloud Build trigger (builds must be able to write their own logs).
  // Without it Cloud Build refuses to accept the SA at trigger-create time.
  'roles/logging.logWriter',
] as const;

type IamCreateSaInput = { app_name: string };
type IamCreateSaOutput = {
  email: string;
  project_id: string;
  roles: string[];
  already_existed: boolean;
  roles_already_bound: string[];
};

export const iamCreateSa: ToolHandler<IamCreateSaInput, IamCreateSaOutput> = async (
  input,
  deps,
) => {
  const appName = String((input as IamCreateSaInput)?.app_name ?? '').trim();
  if (!APP_NAME_RE.test(appName)) {
    return err(
      `invalid app_name "${appName}": must match ${APP_NAME_RE.source}`,
      'invalid_input',
    );
  }

  const iamClient = deps.iam;
  if (!iamClient) {
    return err('iam client not configured on backend', 'iam_not_configured');
  }
  const { iam, crm, projectId } = iamClient;

  const accountId = `idso-${appName}-runtime`;
  const email = `${accountId}@${projectId}.iam.gserviceaccount.com`;
  const member = `serviceAccount:${email}`;
  const log = deps.logger.child({ tool: 'iam_create_sa', app_name: appName, email });

  /* ---- 1. create the SA (idempotent on ALREADY_EXISTS) ---- */
  let alreadyExisted = false;
  try {
    await iam.projects.serviceAccounts.create({
      name: `projects/${projectId}`,
      requestBody: {
        accountId,
        serviceAccount: {
          displayName: `IDSO runtime SA for ${appName}`,
          description: `Per-app runtime SA for the generated idso-${appName} app. Managed by idso-app-generator-v2.`,
        },
      },
    });
    log.info({ event: 'iam_sa_created' }, 'service account created');
    // Eventual consistency: after SA create, setIamPolicy may reject the
    // member as "does not exist" for a few seconds. Sleep briefly to
    // reduce the chance of hitting this on the very first setIamPolicy
    // attempt; the retry loop below still catches the remaining cases.
    await new Promise((r) => setTimeout(r, 2_000));
  } catch (e: unknown) {
    const status =
      (e as { code?: number; status?: number })?.code ??
      (e as { code?: number; status?: number })?.status;
    const msg = e instanceof Error ? e.message : String(e);
    if (status === 409 || /already exists/i.test(msg)) {
      alreadyExisted = true;
      log.info({ event: 'iam_sa_already_exists' }, 'service account already existed; continuing');
    } else {
      log.error({ event: 'iam_sa_create_failed', err: msg, status }, 'failed to create SA');
      return err(`failed to create service account: ${msg}`, 'sa_create_failed');
    }
  }

  /* ---- 2. grant the two project-level roles via get/modify/set IAM policy ---- */
  let rolesAlreadyBound: string[] = [];
  try {
    await withIamPolicyRetry(async (attemptNum) => {
      rolesAlreadyBound = [];
      const { data: policy } = await crm.projects.getIamPolicy({
        resource: projectId,
        requestBody: { options: { requestedPolicyVersion: 3 } },
      });

      const bindings = policy.bindings ?? [];
      let changed = false;
      for (const role of RUNTIME_ROLES) {
        const existing = bindings.find((b) => b.role === role);
        if (existing) {
          const members = existing.members ?? [];
          if (members.includes(member)) {
            rolesAlreadyBound.push(role);
            continue;
          }
          existing.members = [...members, member];
          changed = true;
        } else {
          bindings.push({ role, members: [member] });
          changed = true;
        }
      }

      if (changed) {
        policy.bindings = bindings;
        await crm.projects.setIamPolicy({
          resource: projectId,
          requestBody: { policy },
        });
        log.info(
          {
            event: 'iam_roles_granted',
            attempt: attemptNum,
            roles: RUNTIME_ROLES,
            roles_already_bound: rolesAlreadyBound,
          },
          'project IAM roles granted',
        );
      } else {
        log.info(
          {
            event: 'iam_roles_noop',
            attempt: attemptNum,
            roles_already_bound: rolesAlreadyBound,
          },
          'all roles already bound; no policy change',
        );
      }
    }, log);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error({ event: 'iam_set_policy_failed', err: msg }, 'failed to set project IAM policy');
    return err(`failed to grant roles to ${email}: ${msg}`, 'iam_set_policy_failed');
  }

  return ok({
    email,
    project_id: projectId,
    roles: [...RUNTIME_ROLES],
    already_existed: alreadyExisted,
    roles_already_bound: rolesAlreadyBound,
  });
};
