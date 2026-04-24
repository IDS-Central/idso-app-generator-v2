/**
 * cloud_build_wait (read tool)
 *
 * Poll a Cloud Build build_id until a terminal state is reached (or a
 * client-side timeout). Terminal states per the Cloud Build API:
 * SUCCESS, FAILURE, INTERNAL_ERROR, TIMEOUT, CANCELLED, EXPIRED.
 * Non-terminal: QUEUED, WORKING.
 *
 * Used by the agent loop's auto-repair path: after cloudrun_deploy returns
 * a build_id, the agent (or the loop's post-dispatch hook in loop.ts) calls
 * this to block until the build settles. On FAILURE, repair-loop.ts is
 * invoked by the agent loop to inject a synthetic repair prompt.
 *
 * This is a read-only tool (side_effect: 'read') — safe to call without
 * approval. Polls every 5s, default timeout 15min, hard ceiling 30min.
 */
import { GoogleAuth } from 'google-auth-library';
import {
  ToolHandlerDeps,
  ToolHandler,
  ToolResult,
  ok,
  err,
} from './types.js';

const PROJECT_ID = 'reconciliation-dashboard';
const REGION = 'us-central1';
const TERMINAL_STATES = new Set([
  'SUCCESS',
  'FAILURE',
  'INTERNAL_ERROR',
  'TIMEOUT',
  'CANCELLED',
  'EXPIRED',
]);
const DEFAULT_TIMEOUT_SEC = 900;
const MAX_TIMEOUT_SEC = 1800;
const POLL_INTERVAL_MS = 5000;

interface Input {
  build_id?: string;
  timeout_sec?: number;
}

interface BuildStatus {
  id?: string;
  status?: string;
  logUrl?: string;
  startTime?: string;
  finishTime?: string;
  statusDetail?: string;
  failureInfo?: { type?: string; detail?: string };
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

async function fetchBuild(
  buildId: string,
  token: string,
): Promise<{ httpStatus: number; build: BuildStatus }> {
  const url =
    `https://cloudbuild.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/locations/${REGION}/builds/${encodeURIComponent(buildId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { httpStatus: res.status, build: body as BuildStatus };
}

export const cloudBuildWait: ToolHandler = async (
  input: unknown,
  deps: ToolHandlerDeps,
): Promise<ToolResult> => {
  const i = (input ?? {}) as Input;
  const buildId = (i.build_id ?? '').trim();
  if (!buildId) return err('build_id is required', 'bad_input');
  const timeoutSec = Math.min(
    MAX_TIMEOUT_SEC,
    Math.max(30, i.timeout_sec ?? DEFAULT_TIMEOUT_SEC),
  );
  const log = deps.logger.child({ tool: 'cloud_build_wait', build_id: buildId });
  try {
    const token = await getAccessToken();
    const deadline = Date.now() + timeoutSec * 1000;
    let last: BuildStatus = {};
    let polls = 0;
    while (Date.now() < deadline) {
      polls += 1;
      const r = await fetchBuild(buildId, token);
      last = r.build;
      if (r.httpStatus === 404) {
        // Regional propagation can lag a few seconds after trigger fire.
        if (polls > 3) {
          return err(
            `build ${buildId} not found (HTTP 404 after ${polls} polls)`,
            'not_found',
          );
        }
      } else if (r.httpStatus >= 200 && r.httpStatus < 300) {
        const state = (last.status ?? '').toUpperCase();
        if (state && TERMINAL_STATES.has(state)) {
          log.info(
            { status: state, polls, log_url: last.logUrl },
            'cloud_build_wait_terminal',
          );
          return ok({
            build_id: buildId,
            status: state,
            log_url: last.logUrl ?? '',
            start_time: last.startTime ?? '',
            finish_time: last.finishTime ?? '',
            status_detail: last.statusDetail ?? '',
            failure_type: last.failureInfo?.type ?? '',
            failure_detail: last.failureInfo?.detail ?? '',
            polls,
          });
        }
      } else if (
        r.httpStatus >= 400 &&
        r.httpStatus < 500 &&
        r.httpStatus !== 429
      ) {
        return err(
          `cloud build GET returned HTTP ${r.httpStatus}`,
          'api_error',
        );
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    log.warn(
      { polls, last_status: last.status },
      'cloud_build_wait_timed_out',
    );
    return ok({
      build_id: buildId,
      status: 'TIMEOUT',
      log_url: last.logUrl ?? '',
      start_time: last.startTime ?? '',
      finish_time: '',
      status_detail: `polled ${polls}x, last=${last.status ?? 'unknown'}`,
      failure_type: 'CLIENT_TIMEOUT',
      failure_detail: `exceeded ${timeoutSec}s poll budget`,
      polls,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error({ error: msg }, 'cloud_build_wait_failed');
    return err(msg, 'cloud_build_wait_failed');
  }
};