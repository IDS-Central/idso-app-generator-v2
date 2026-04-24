/**
 * Build-sandbox tools.
 *
 * run_in_build_sandbox: runs a short-lived Cloud Run Job to execute a
 *   shell script inside a controlled sandbox. Returns the execution name
 *   and a best-effort status after waiting up to 10s for initial state.
 *
 * The job is a pre-provisioned Cloud Run Job template named
 * "idso-build-sandbox" in us-central1. This tool triggers an execution
 * with ephemeral overrides (env vars + script) and does NOT create new
 * job definitions. If the sandbox template does not exist the tool
 * returns a structured error so the orchestrator can surface a clear
 * remediation hint.
 *
 * Expected pre-provision (out of band):
 *   gcloud run jobs create idso-build-sandbox \
 *     --image=us-docker.pkg.dev/cloudrun/container/job:latest \
 *     --region=us-central1 --task-timeout=600s \
 *     --command=/bin/bash --args=-c,"$$SCRIPT"
 * (The runtime SA needs roles/run.developer to trigger it.)
 */
import { GoogleAuth } from 'google-auth-library';
import type { ToolHandler, ToolHandlerDeps } from './types.js';
import { ok, err } from './types.js';

const PROJECT_ID = 'reconciliation-dashboard';
const REGION = 'us-central1';
const JOB_NAME = 'idso-build-sandbox';
const SCRIPT_MAX_LEN = 16_384;

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  if (!t.token) throw new Error('no access token');
  return t.token;
}

interface RunInBuildSandboxInput { script?: string; env?: Record<string, string>; timeout_seconds?: number }
interface RunInBuildSandboxOutput {
  execution_name: string;
  state: string;
  note: string;
}

export const runInBuildSandbox: ToolHandler<RunInBuildSandboxInput, RunInBuildSandboxOutput> = async (
  input,
  deps: ToolHandlerDeps,
) => {
  const i = input as RunInBuildSandboxInput;
  const script = String(i?.script ?? '');
  const env = (i?.env ?? {}) as Record<string, string>;
  const timeoutSec = Math.min(900, Math.max(30, Number(i?.timeout_seconds ?? 300)));
  if (script.length === 0) return err('script must be non-empty', 'invalid_input');
  if (script.length > SCRIPT_MAX_LEN) return err(`script too long (max ${SCRIPT_MAX_LEN} chars)`, 'invalid_input');
  // Guardrails: refuse obviously destructive invocations in the script.
  if (/\brm\s+-rf\s+\/(?!tmp\b)/.test(script) || /mkfs|dd\s+if=/.test(script)) {
    return err('script contains disallowed destructive patterns', 'script_rejected');
  }
  // Validate env keys/values: keys are UPPER_SNAKE, values are strings <= 4KB
  for (const [k, v] of Object.entries(env)) {
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(k)) return err(`invalid env key "${k}"`, 'invalid_input');
    if (typeof v !== 'string' || v.length > 4096) return err(`invalid env value for "${k}"`, 'invalid_input');
  }

  const log = deps.logger.child({ tool: 'run_in_build_sandbox', job: JOB_NAME, script_len: script.length });
  const token = await getAccessToken();
  const resource = `projects/${PROJECT_ID}/locations/${REGION}/jobs/${JOB_NAME}`;
  const url = `https://run.googleapis.com/v2/${resource}:run`;

  const overrides = {
    overrides: {
      containerOverrides: [
        {
          args: ['-c', script],
          env: Object.entries(env).map(([name, value]) => ({ name, value })),
        },
      ],
      timeout: `${timeoutSec}s`,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(overrides),
  });
  const text = await res.text();
  if (res.status === 404) {
    return err(
      `sandbox job "${JOB_NAME}" does not exist in ${REGION}. Provision it first (see file comment).`,
      'sandbox_not_provisioned',
    );
  }
  if (res.status >= 400) {
    return err(`failed to trigger sandbox: HTTP ${res.status}: ${text.slice(0, 300)}`, 'sandbox_run_failed');
  }
  let body: { name?: string; metadata?: { name?: string } } = {};
  try { body = JSON.parse(text) as typeof body; } catch { /* ignore */ }
  const execName = body.metadata?.name ?? body.name ?? 'unknown';
  log.info({ event: 'sandbox_started', execution_name: execName }, 'sandbox execution started');
  return ok({
    execution_name: execName,
    state: 'RUNNING',
    note: 'Execution started asynchronously. Use read_cloud_run_logs with service_name matching the job execution for full output.',
  });
};
