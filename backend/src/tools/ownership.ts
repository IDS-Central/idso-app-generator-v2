/**
 * Ownership tools.
 *
 * list_user_apps: lists Cloud Run services in the project that match the
 *   idso-app-<name>-<env> pattern and returns app metadata (name, env, url,
 *   latestRevision). No user filter yet  Phase 2 just surfaces everything.
 * write_owner_file: writes (or overwrites) the owner metadata file for an
 *   app to GitHub at .idso/owner.json under IDS-Central/idso-app-<name>.
 *   This is how provenance is tracked across sessions.
 */
import { GoogleAuth } from 'google-auth-library';
import type { ToolHandler, ToolHandlerDeps } from './types.js';
import type { GithubClient } from './github.js';
import { ok, err } from './types.js';

const PROJECT_ID = 'reconciliation-dashboard';
const REGION = 'us-central1';
const GH_OWNER = 'IDS-Central';
const APP_NAME_RE = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/;

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  if (!t.token) throw new Error('no access token');
  return t.token;
}

async function apiCall<T>(url: string, method: string, token: string, body?: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let b: unknown = {};
  try { b = text ? JSON.parse(text) : {}; } catch { b = { raw: text }; }
  return { status: res.status, body: b as T };
}

/* -------------------- list_user_apps -------------------- */
interface ListUserAppsInput { /* no inputs */ }
interface AppSummary { app_name: string; env: string; service_name: string; url: string | null; latest_revision: string | null }
interface ListUserAppsOutput { apps: AppSummary[]; count: number }

export const listUserApps: ToolHandler<ListUserAppsInput, ListUserAppsOutput> = async (
  _input,
  deps: ToolHandlerDeps,
) => {
  const log = deps.logger.child({ tool: 'list_user_apps' });
  const token = await getAccessToken();
  const url = `https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/services?pageSize=200`;
  interface Svc { name?: string; uri?: string; latestReadyRevision?: string }
  interface Resp { services?: Svc[]; error?: { message?: string } }
  const r = await apiCall<Resp>(url, 'GET', token);
  if (r.status >= 400) {
    const msg = r.body.error?.message ?? `HTTP ${r.status}`;
    return err(`failed to list Cloud Run services: ${msg}`, 'run_list_failed');
  }
  const svcs = r.body.services ?? [];
  const apps: AppSummary[] = [];
  // service name format: projects/{p}/locations/{l}/services/{service_id}
  // our apps are named idso-app-<app_name>-<env> for dev and idso-app-<app_name> for prod
  const re = /services\/(idso-app-(.+?))(?:-(dev|prod))?$/;
  for (const svc of svcs) {
    const svcName = svc.name ?? '';
    const m = svcName.match(re);
    if (!m) continue;
    const serviceId = m[1] ?? '';
    const appAndMaybeEnv = m[2] ?? '';
    const env = m[3] ?? 'prod';
    apps.push({
      app_name: appAndMaybeEnv,
      env,
      service_name: serviceId,
      url: svc.uri ?? null,
      latest_revision: svc.latestReadyRevision ?? null,
    });
  }
  log.info({ event: 'list_user_apps_ok', count: apps.length }, 'listed apps');
  return ok({ apps, count: apps.length });
};

/* -------------------- write_owner_file -------------------- */
interface WriteOwnerFileInput { app_name?: string; owner_email?: string; notes?: string }
interface WriteOwnerFileOutput { path: string; commit_sha: string; html_url: string }

export const writeOwnerFile: ToolHandler<WriteOwnerFileInput, WriteOwnerFileOutput> = async (
  input,
  deps: ToolHandlerDeps,
) => {
  const i = input as WriteOwnerFileInput;
  const appName = String(i?.app_name ?? '').trim();
  const ownerEmail = String(i?.owner_email ?? '').trim();
  const notes = String(i?.notes ?? '').slice(0, 1000);
  if (!APP_NAME_RE.test(appName)) return err(`invalid app_name "${appName}"`, 'invalid_input');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) return err(`invalid owner_email "${ownerEmail}"`, 'invalid_input');
  const gh: GithubClient | undefined = deps.gh;
  if (!gh) return err('github client not configured on backend', 'gh_not_configured');
  const log = deps.logger.child({ tool: 'write_owner_file', app_name: appName });

  const repo = `idso-app-${appName}`;
  const path = '.idso/owner.json';
  const content = JSON.stringify(
    {
      app_name: appName,
      owner_email: ownerEmail,
      notes,
      updated_at: new Date().toISOString(),
      managed_by: 'idso-app-generator-v2',
    },
    null,
    2,
  ) + '\n';
  const contentB64 = Buffer.from(content, 'utf8').toString('base64');

  const ghToken = await gh.getInstallationToken();
  const base = `https://api.github.com/repos/${GH_OWNER}/${repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${ghToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'idso-app-generator-v2',
  } as const;

  // Try to get existing file sha
  let existingSha: string | undefined;
  const got = await fetch(base, { method: 'GET', headers });
  if (got.status === 200) {
    const j = (await got.json()) as { sha?: string };
    existingSha = j?.sha;
  } else if (got.status !== 404) {
    const t = await got.text();
    log.warn({ event: 'owner_file_get_failed', status: got.status, body: t.slice(0, 200) }, 'unexpected error reading existing owner file; proceeding as create');
  }

  const putBody: Record<string, unknown> = {
    message: `chore(idso): update ${path} via idso-app-generator-v2`,
    content: contentB64,
  };
  if (existingSha) putBody.sha = existingSha;
  const put = await fetch(base, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(putBody) });
  const putText = await put.text();
  if (put.status >= 400) {
    return err(`failed to write owner file: HTTP ${put.status}: ${putText.slice(0, 200)}`,
               put.status === 404 ? 'repo_not_found' : 'gh_write_failed');
  }
  let putJson: { content?: { sha?: string; html_url?: string }; commit?: { sha?: string; html_url?: string } } = {};
  try { putJson = JSON.parse(putText); } catch { /* ignore */ }
  const commitSha = putJson.commit?.sha ?? '';
  const htmlUrl = putJson.content?.html_url ?? '';
  log.info({ event: 'owner_file_written', commit_sha: commitSha }, 'owner file written');
  return ok({ path, commit_sha: commitSha, html_url: htmlUrl });
};
