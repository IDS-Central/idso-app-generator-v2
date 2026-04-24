import { GoogleAuth } from 'google-auth-library';
import type { ToolHandler, ToolHandlerDeps, ToolResult } from './types';
import { ok, err } from './types';

/**
 * cloudrun_deploy  Phase 2 Commit 2b, part 4/4.
 *
 * Triggers an immediate Cloud Build run of the existing `idso-app-{name}-{env}`
 * trigger created by cloudbuild_create_trigger. The trigger's `cloudbuild.yaml`
 * contains the `gcloud run deploy` step, so the Cloud Run service itself is
 * deployed as part of that pipeline  this tool just bypasses the wait for
 * the next git push.
 *
 * IAM: runtime SA needs roles/cloudbuild.builds.builder (already granted by
 * iam_create_sa). No new roles required.
 */

const APP_NAME_RE = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/;
const ENV_VALUES = new Set(['dev', 'prod']);
const REGION = 'us-central1';
const PROJECT_ID = 'reconciliation-dashboard';

interface Input {
  app_name?: string;
  env?: string;
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

export const cloudrunDeploy: ToolHandler = async (
  input: unknown,
  deps: ToolHandlerDeps,
): Promise<ToolResult> => {
  const i = (input ?? {}) as Input;
  const appName = (i.app_name ?? '').trim();
  const env = (i.env ?? '').trim();
  if (!APP_NAME_RE.test(appName)) {
    return err(`invalid app_name: ${appName}`, 'bad_input');
  }
  if (!ENV_VALUES.has(env)) {
    return err(`invalid env: ${env} (want dev|prod)`, 'bad_input');
  }
  const triggerName = env === 'dev' ? `idso-app-${appName}-${env}` : `idso-app-${appName}`;
  const log = deps.logger.child({
    tool: 'cloudrun_deploy',
    app_name: appName,
    env,
    trigger: triggerName,
  });

  try {
    const token = await getAccessToken();
    // Fire the regional trigger. Path matches cloudbuild_create_trigger's createUrl.
    const runUrl = `https://cloudbuild.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/triggers/${triggerName}:run`;
    const runRes = await apiCall<{
      name?: string;
      metadata?: { build?: { id?: string; logUrl?: string; status?: string } };
      error?: { message?: string; status?: string };
    }>(runUrl, {
      method: 'POST',
      body: { source: { branchName: 'main' } },
      token,
    });
    if (runRes.status < 200 || runRes.status >= 300) {
      const anyBody = runRes.body as { error?: { message?: string; status?: string } };
      const apiMsg = anyBody?.error?.message ?? JSON.stringify(runRes.body);
      const apiStatus = anyBody?.error?.status ?? String(runRes.status);
      log.error(
        { http_status: runRes.status, api_status: apiStatus, api_message: apiMsg },
        'cloudrun_deploy_run_trigger_failed',
      );
      return err(`trigger :run returned ${runRes.status} (${apiStatus}): ${apiMsg}`, 'cloudrun_deploy_failed');
    }
    const ok_body = runRes.body as {
      name?: string;
      metadata?: { build?: { id?: string; logUrl?: string; status?: string } };
    };
    const buildId = ok_body.metadata?.build?.id ?? '';
    const logUrl = ok_body.metadata?.build?.logUrl ?? '';
    const buildStatus = ok_body.metadata?.build?.status ?? 'QUEUED';
    log.info({ build_id: buildId, log_url: logUrl, status: buildStatus }, 'cloudrun_deploy_started');
    return ok({
      build_id: buildId,
      build_status: buildStatus,
      build_log_url: logUrl,
      trigger_name: triggerName,
      operation_name: ok_body.name ?? '',
      note:
        'Build started. The cloudbuild.yaml pipeline will build the image and run `gcloud run deploy` to create/update the Cloud Run service. Poll the log URL or the Cloud Build console for progress.',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error({ error: msg }, 'cloudrun_deploy_threw');
    return err(msg, 'cloudrun_deploy_failed');
  }
};
