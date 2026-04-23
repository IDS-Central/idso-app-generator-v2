/**
 * cloudbuild_create_trigger handler
 *
 * Creates (idempotently):
 *   1. A DeveloperConnect gitRepositoryLink under the project-standard
 *      connection `connection-bu2d4s3` (us-central1).
 *   2. A Cloud Build trigger that watches `main` on that repo and runs
 *      `backend/cloudbuild.yaml` (or `cloudbuild.yaml` if no backend/)
 *      with the per-app runtime SA.
 *
 * Assumes:
 *  - The repo already exists on GitHub (gh_create_repo has run).
 *  - The per-app runtime SA already exists (iam_create_sa has run).
 *  - The project-level DeveloperConnect connection `connection-bu2d4s3`
 *    is already authorised against the IDS-Central org. This is a
 *    one-time project-level setup done via the Cloud Build console.
 *
 * All HTTP calls go through google-auth-library Application Default
 * Credentials so the Cloud Run service's attached SA is used.
 */
import { GoogleAuth } from 'google-auth-library';
import {
  ToolHandlerDeps,
  ToolHandler,
  ToolResult,
  ok,
  err,
} from './types.js';

const APP_NAME_RE = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/;
const ENV_VALUES = new Set(['dev', 'prod']);
const CONNECTION_NAME =
  'projects/reconciliation-dashboard/locations/us-central1/connections/connection-bu2d4s3';
const REGION = 'us-central1';
const PROJECT_ID = 'reconciliation-dashboard';

interface Input {
  app_name?: string;
  env?: string;
  github_repo?: string;
}

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('no access token');
  return token.token;
}

async function apiCall<T>(
  url: string,
  init: { method: string; body?: unknown; token: string },
): Promise<{ status: number; body: T | { error?: { message?: string; status?: string } } }> {
  const res = await fetch(url, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${init.token}`,
      'Content-Type': 'application/json',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body: body as T };
}

/**
 * Create the DeveloperConnect gitRepositoryLink. Idempotent on 409.
 * Returns the full resource name when ready.
 */
async function ensureGitRepositoryLink(
  token: string,
  linkId: string,
  cloneUri: string,
  log: ToolHandlerDeps['logger'],
): Promise<string> {
  const linkName = `${CONNECTION_NAME}/gitRepositoryLinks/${linkId}`;
  const createUrl =
    `https://developerconnect.googleapis.com/v1/${CONNECTION_NAME}/gitRepositoryLinks` +
    `?gitRepositoryLinkId=${encodeURIComponent(linkId)}`;
  const createBody = { cloneUri };
  const created = await apiCall<{ name?: string; error?: { message?: string } }>(createUrl, {
    method: 'POST',
    body: createBody,
    token,
  });
  if (created.status === 200 || created.status === 201) {
    log.info({ link: linkName, op: 'created' }, 'gitRepositoryLink_created_op');
  } else if (created.status === 409) {
    log.info({ link: linkName }, 'gitRepositoryLink_already_exists');
  } else {
    const e = (created.body as { error?: { message?: string } }).error;
    throw new Error(
      `gitRepositoryLink create failed: HTTP ${created.status} ${e?.message ?? JSON.stringify(created.body)}`,
    );
  }
  // Poll until state becomes COMPLETE (LRO pattern).
  const getUrl = `https://developerconnect.googleapis.com/v1/${linkName}`;
  for (let i = 0; i < 20; i++) {
    const got = await apiCall<{ name?: string; createTime?: string }>(getUrl, {
      method: 'GET',
      token,
    });
    if (got.status === 200 && (got.body as { name?: string }).name) {
      return linkName;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`gitRepositoryLink ${linkName} did not become ready`);
}

/**
 * Create the Cloud Build trigger. Idempotent on 409 (ALREADY_EXISTS).
 */
async function ensureTrigger(
  token: string,
  args: {
    triggerName: string;
    serviceAccountEmail: string;
    linkName: string;
    filename: string;
    includedFiles: string[];
    substitutions: Record<string, string>;
    description: string;
  },
  log: ToolHandlerDeps['logger'],
): Promise<{ triggerId: string; resourceName: string }> {
  const parent = `projects/${PROJECT_ID}/locations/${REGION}`;
  const createUrl = `https://cloudbuild.googleapis.com/v1/${parent}/triggers`;
  const body = {
    name: args.triggerName,
    description: args.description,
    serviceAccount: `projects/${PROJECT_ID}/serviceAccounts/${args.serviceAccountEmail}`,
    developerConnectEventConfig: {
      gitRepositoryLink: args.linkName,
      push: { branch: '^main$' },
    },
    filename: args.filename,
    includedFiles: args.includedFiles,
    substitutions: args.substitutions,
  };
  const created = await apiCall<{ id?: string; name?: string; error?: { message?: string; status?: string } }>(createUrl, {
    method: 'POST',
    body,
    token,
  });
  if (created.status === 200 || created.status === 201) {
    const b = created.body as { id?: string; resourceName?: string; name?: string };
    log.info({ trigger: args.triggerName, id: b.id }, 'cloudbuild_trigger_created');
    return {
      triggerId: b.id ?? '',
      resourceName: b.resourceName ?? b.name ?? `${parent}/triggers/${b.id}`,
    };
  }
  if (
    created.status === 409 ||
    (created.body as { error?: { status?: string } }).error?.status === 'ALREADY_EXISTS'
  ) {
    // Look it up by name (list + filter)
    const listUrl = `${createUrl}?pageSize=100`;
    const list = await apiCall<{ triggers?: Array<{ id?: string; name?: string; resourceName?: string }> }>(listUrl, {
      method: 'GET',
      token,
    });
    const match = (list.body as { triggers?: Array<{ id?: string; name?: string; resourceName?: string }> }).triggers?.find(
      (t) => t.name === args.triggerName,
    );
    if (match?.id) {
      log.info({ trigger: args.triggerName, id: match.id }, 'cloudbuild_trigger_already_exists');
      return {
        triggerId: match.id,
        resourceName: match.resourceName ?? `${parent}/triggers/${match.id}`,
      };
    }
    throw new Error(`trigger ${args.triggerName} exists but could not be located via list`);
  }
  const e = (created.body as { error?: { message?: string; status?: string } }).error;
  throw new Error(
    `cloudbuild trigger create failed: HTTP ${created.status} ${e?.status ?? ''} ${e?.message ?? JSON.stringify(created.body)}`,
  );
}

export const cloudbuildCreateTrigger: ToolHandler = async (
  input: unknown,
  deps: ToolHandlerDeps,
): Promise<ToolResult> => {
  const i = (input ?? {}) as Input;
  const appName = (i.app_name ?? '').trim();
  const env = (i.env ?? '').trim();
  const githubRepo = (i.github_repo ?? '').trim();
  if (!APP_NAME_RE.test(appName))
    return err(`invalid app_name: ${appName}`, 'bad_input');
  if (!ENV_VALUES.has(env))
    return err(`invalid env: ${env} (want dev|prod)`, 'bad_input');
  if (!githubRepo || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(githubRepo))
    return err(`invalid github_repo: ${githubRepo}`, 'bad_input');

  const [ghOwner, ghName] = githubRepo.split('/');
  const linkId = `${ghOwner}-${ghName}`;
  const cloneUri = `https://github.com/${ghOwner}/${ghName}.git`;
  const serviceAccountEmail = `idso-${appName}-runtime@${PROJECT_ID}.iam.gserviceaccount.com`;
  const triggerName =
    env === 'dev' ? `idso-app-${appName}-${env}` : `idso-app-${appName}`;
  const log = deps.logger.child({
    tool: 'cloudbuild_create_trigger',
    app_name: appName,
    env,
    trigger: triggerName,
  });

  try {
    const token = await getAccessToken();
    const linkName = await ensureGitRepositoryLink(token, linkId, cloneUri, log);
    const { triggerId, resourceName } = await ensureTrigger(
      token,
      {
        triggerName,
        serviceAccountEmail,
        linkName,
        filename: 'cloudbuild.yaml',
        includedFiles: ['**'],
        substitutions: { _ENV: env, _APP_NAME: appName, _REGION: REGION, _SERVICE_ACCOUNT: serviceAccountEmail },
        description: `Build and deploy ${appName} (${env}) on push to main`,
      },
      log,
    );
    log.info({ trigger_id: triggerId }, 'cloudbuild_trigger_ready');
    return ok({
      trigger_id: triggerId,
      trigger_name: triggerName,
      resource_name: resourceName,
      git_repository_link: linkName,
      service_account: serviceAccountEmail,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error({ error: msg }, 'cloudbuild_create_trigger_failed');
    return err(msg, 'cloudbuild_create_trigger_failed');
  }
};
