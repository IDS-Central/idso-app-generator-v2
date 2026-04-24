/**
 * Log reading tools.
 *
 * read_build_logs: reads Cloud Logging entries for a specific Cloud Build
 *   build id. Returns the most recent N log lines (default 200, max 1000).
 * read_cloud_run_logs: reads Cloud Logging entries for a specific Cloud Run
 *   service (optionally scoped to a revision). Returns the most recent N
 *   log lines (default 200, max 1000).
 *
 * Uses entries.list against Cloud Logging v2 with appropriate filters.
 */
import { GoogleAuth } from 'google-auth-library';
import type { ToolHandler, ToolHandlerDeps } from './types.js';
import { ok, err } from './types.js';

const PROJECT_ID = 'reconciliation-dashboard';
const BUILD_ID_RE = /^[0-9a-f-]{16,64}$/i;
const SVC_NAME_RE = /^[a-z][a-z0-9-]{1,62}[a-z0-9]$/;

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  if (!t.token) throw new Error('no access token');
  return t.token;
}

interface LogEntry {
  timestamp?: string;
  severity?: string;
  textPayload?: string;
  jsonPayload?: Record<string, unknown>;
  resource?: { type?: string; labels?: Record<string, string> };
}

async function listLogEntries(
  filter: string,
  pageSize: number,
  token: string,
): Promise<{ entries: LogEntry[]; errorMsg?: string }> {
  const url = 'https://logging.googleapis.com/v2/entries:list';
  const body = {
    resourceNames: [`projects/${PROJECT_ID}`],
    filter,
    orderBy: 'timestamp desc',
    pageSize,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let j: { entries?: LogEntry[]; error?: { message?: string } } = {};
  try { j = JSON.parse(text) as typeof j; } catch { /* ignore */ }
  if (res.status >= 400) {
    return { entries: [], errorMsg: j.error?.message ?? `HTTP ${res.status}: ${text.slice(0, 200)}` };
  }
  return { entries: j.entries ?? [] };
}

function summariseEntry(e: LogEntry): { timestamp: string; severity: string; message: string } {
  const ts = e.timestamp ?? '';
  const sev = e.severity ?? 'DEFAULT';
  let msg = '';
  if (typeof e.textPayload === 'string') msg = e.textPayload;
  else if (e.jsonPayload) {
    const jp = e.jsonPayload as { message?: string };
    msg = typeof jp.message === 'string' ? jp.message : JSON.stringify(e.jsonPayload);
  }
  return { timestamp: ts, severity: sev, message: msg.slice(0, 2000) };
}

/* -------------------- read_build_logs -------------------- */
interface ReadBuildLogsInput { build_id?: string; limit?: number }
interface LogLine { timestamp: string; severity: string; message: string }
interface ReadBuildLogsOutput { build_id: string; entry_count: number; entries: LogLine[] }

export const readBuildLogs: ToolHandler<ReadBuildLogsInput, ReadBuildLogsOutput> = async (
  input,
  deps: ToolHandlerDeps,
) => {
  const i = input as ReadBuildLogsInput;
  const id = String(i?.build_id ?? '').trim();
  const limit = Math.min(1000, Math.max(1, Number(i?.limit ?? 200)));
  if (!BUILD_ID_RE.test(id)) return err(`invalid build_id "${id}"`, 'invalid_input');
  const log = deps.logger.child({ tool: 'read_build_logs', build_id: id });
  const token = await getAccessToken();
  const filter = `resource.type="build" AND resource.labels.build_id="${id}"`;
  const r = await listLogEntries(filter, limit, token);
  if (r.errorMsg) return err(`failed to read build logs: ${r.errorMsg}`, 'logs_list_failed');
  const entries = r.entries.map(summariseEntry);
  log.info({ event: 'build_logs_read', count: entries.length }, 'build logs read');
  return ok({ build_id: id, entry_count: entries.length, entries });
};

/* -------------------- read_cloud_run_logs -------------------- */
interface ReadCloudRunLogsInput { service_name?: string; revision_name?: string; limit?: number }
interface ReadCloudRunLogsOutput { service_name: string; revision_name: string | null; entry_count: number; entries: LogLine[] }

export const readCloudRunLogs: ToolHandler<ReadCloudRunLogsInput, ReadCloudRunLogsOutput> = async (
  input,
  deps: ToolHandlerDeps,
) => {
  const i = input as ReadCloudRunLogsInput;
  const svc = String(i?.service_name ?? '').trim();
  const rev = i?.revision_name ? String(i.revision_name).trim() : null;
  const limit = Math.min(1000, Math.max(1, Number(i?.limit ?? 200)));
  if (!SVC_NAME_RE.test(svc)) return err(`invalid service_name "${svc}"`, 'invalid_input');
  if (rev !== null && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(rev)) return err(`invalid revision_name "${rev}"`, 'invalid_input');
  const log = deps.logger.child({ tool: 'read_cloud_run_logs', service_name: svc, revision_name: rev });
  const token = await getAccessToken();
  let filter = `resource.type="cloud_run_revision" AND resource.labels.service_name="${svc}"`;
  if (rev) filter += ` AND resource.labels.revision_name="${rev}"`;
  const r = await listLogEntries(filter, limit, token);
  if (r.errorMsg) return err(`failed to read run logs: ${r.errorMsg}`, 'logs_list_failed');
  const entries = r.entries.map(summariseEntry);
  log.info({ event: 'run_logs_read', count: entries.length }, 'run logs read');
  return ok({ service_name: svc, revision_name: rev, entry_count: entries.length, entries });
};
