/**
 * Post-deploy verification tools (Phase 2 plan item #9).
 *
 * cloud_run_curl_protected: hits an endpoint on a Cloud Run service WITHOUT
 *   any auth, and asserts a specific status code (expected 401 for
 *   protected paths). Returns ok if the status matches, err otherwise.
 *   This is the signal the loop uses to confirm that a generated app's
 *   protected route is actually protected after deploy.
 *
 * cloud_run_curl_health: hits /api/health (or any public path) on a Cloud
 *   Run service, follows no redirects, and asserts 200. Lightweight smoke.
 */
import type { ToolHandler, ToolHandlerDeps } from './types.js';
import { ok, err } from './types.js';

const URL_RE = /^https:\/\/[^\s]{1,2048}$/;

async function timedFetch(url: string, timeoutMs = 10_000): Promise<{ status: number; bodyExcerpt: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: ctrl.signal });
    const text = await res.text().catch(() => '');
    return { status: res.status, bodyExcerpt: text.slice(0, 200) };
  } finally {
    clearTimeout(t);
  }
}

/* -------------------- cloud_run_curl_protected -------------------- */
interface CrCurlProtectedInput { url?: string; expected_status?: number }
interface CrCurlProtectedOutput { url: string; actual_status: number; expected_status: number; body_excerpt: string; ok: boolean }

export const cloudRunCurlProtected: ToolHandler<CrCurlProtectedInput, CrCurlProtectedOutput> = async (
  input,
  deps: ToolHandlerDeps,
) => {
  const i = input as CrCurlProtectedInput;
  const url = String(i?.url ?? '').trim();
  const expected = Number(i?.expected_status ?? 401);
  if (!URL_RE.test(url)) return err(`invalid url "${url}" (must be https)`, 'invalid_input');
  if (!Number.isInteger(expected) || expected < 100 || expected > 599) return err(`invalid expected_status ${expected}`, 'invalid_input');
  const log = deps.logger.child({ tool: 'cloud_run_curl_protected', url, expected_status: expected });
  const r = await timedFetch(url);
  const isOk = r.status === expected;
  log.info({ event: 'cr_curl_protected_checked', actual_status: r.status, expected_status: expected, ok: isOk }, 'protected curl complete');
  const out = { url, actual_status: r.status, expected_status: expected, body_excerpt: r.bodyExcerpt, ok: isOk };
  if (!isOk) {
    return err(`protected endpoint returned ${r.status}, expected ${expected}. This indicates the authentication guard is missing or misconfigured.`, 'verification_failed');
  }
  return ok(out);
};

/* -------------------- cloud_run_curl_health -------------------- */
interface CrCurlHealthInput { url?: string }
interface CrCurlHealthOutput { url: string; actual_status: number; body_excerpt: string }

export const cloudRunCurlHealth: ToolHandler<CrCurlHealthInput, CrCurlHealthOutput> = async (
  input,
  deps: ToolHandlerDeps,
) => {
  const i = input as CrCurlHealthInput;
  const url = String(i?.url ?? '').trim();
  if (!URL_RE.test(url)) return err(`invalid url "${url}"`, 'invalid_input');
  const log = deps.logger.child({ tool: 'cloud_run_curl_health', url });
  const r = await timedFetch(url);
  log.info({ event: 'cr_curl_health_checked', actual_status: r.status }, 'health curl complete');
  if (r.status !== 200) {
    return err(`health endpoint returned ${r.status} (expected 200). Body: ${r.bodyExcerpt}`, 'health_check_failed');
  }
  return ok({ url, actual_status: r.status, body_excerpt: r.bodyExcerpt });
};
