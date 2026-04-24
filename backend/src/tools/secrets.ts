/**
 * Secret Manager tools.
 *
 * secret_create: creates a Secret Manager secret (idempotent on ALREADY_EXISTS)
 *   and optionally adds an initial version.
 * secret_add_version: adds a new version (plaintext payload) to an existing secret.
 * secret_access: accesses the latest version of a secret (returns payload).
 *
 * All operations use the Cloud Run service's attached runtime SA (ADC).
 */
import { GoogleAuth } from 'google-auth-library';
import type { ToolHandler, ToolHandlerDeps } from './types.js';
import { ok, err } from './types.js';

const PROJECT_ID = 'reconciliation-dashboard';
const SECRET_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_-]{0,254}$/;

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  if (!t.token) throw new Error('no access token');
  return t.token;
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
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { status: res.status, body: body as T };
}

/* -------------------- secret_create -------------------- */
interface SecretCreateInput { secret_id?: string; initial_value?: string }
interface SecretCreateOutput { name: string; already_existed: boolean; version_added: boolean }

export const secretCreate: ToolHandler<SecretCreateInput, SecretCreateOutput> = async (
  input,
  deps: ToolHandlerDeps,
) => {
  const i = input as SecretCreateInput;
  const id = String(i?.secret_id ?? '').trim();
  if (!SECRET_NAME_RE.test(id)) {
    return err(`invalid secret_id "${id}": must match ${SECRET_NAME_RE.source}`, 'invalid_input');
  }
  const log = deps.logger.child({ tool: 'secret_create', secret_id: id });
  const token = await getAccessToken();
  const parent = `projects/${PROJECT_ID}`;
  const fullName = `${parent}/secrets/${id}`;

  let alreadyExisted = false;
  const createUrl = `https://secretmanager.googleapis.com/v1/${parent}/secrets?secretId=${encodeURIComponent(id)}`;
  const createBody = { replication: { automatic: {} } };
  const created = await apiCall<{ name?: string; error?: { message?: string; status?: string } }>(createUrl, {
    method: 'POST', body: createBody, token,
  });
  if (created.status === 409 || (created.body as { error?: { status?: string } }).error?.status === 'ALREADY_EXISTS') {
    alreadyExisted = true;
    log.info({ event: 'secret_already_exists' }, 'secret already existed; continuing');
  } else if (created.status >= 400) {
    const msg = (created.body as { error?: { message?: string } }).error?.message ?? `HTTP ${created.status}`;
    return err(`failed to create secret: ${msg}`, 'secret_create_failed');
  } else {
    log.info({ event: 'secret_created', name: fullName }, 'secret created');
  }

  let versionAdded = false;
  if (typeof i.initial_value === 'string' && i.initial_value.length > 0) {
    const addUrl = `https://secretmanager.googleapis.com/v1/${fullName}:addVersion`;
    const payload = { payload: { data: Buffer.from(i.initial_value, 'utf8').toString('base64') } };
    const v = await apiCall<{ name?: string; error?: { message?: string } }>(addUrl, {
      method: 'POST', body: payload, token,
    });
    if (v.status >= 400) {
      const msg = (v.body as { error?: { message?: string } }).error?.message ?? `HTTP ${v.status}`;
      return err(`secret created but addVersion failed: ${msg}`, 'secret_add_version_failed');
    }
    versionAdded = true;
    log.info({ event: 'secret_version_added' }, 'initial version added');
  }

  return ok({ name: fullName, already_existed: alreadyExisted, version_added: versionAdded });
};

/* -------------------- secret_add_version -------------------- */
interface SecretAddVersionInput { secret_id?: string; value?: string }
interface SecretAddVersionOutput { version_name: string }

export const secretAddVersion: ToolHandler<SecretAddVersionInput, SecretAddVersionOutput> = async (
  input,
  deps: ToolHandlerDeps,
) => {
  const i = input as SecretAddVersionInput;
  const id = String(i?.secret_id ?? '').trim();
  const value = String(i?.value ?? '');
  if (!SECRET_NAME_RE.test(id)) return err(`invalid secret_id "${id}"`, 'invalid_input');
  if (value.length === 0) return err('value must be non-empty', 'invalid_input');
  const log = deps.logger.child({ tool: 'secret_add_version', secret_id: id });
  const token = await getAccessToken();
  const url = `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${id}:addVersion`;
  const body = { payload: { data: Buffer.from(value, 'utf8').toString('base64') } };
  const r = await apiCall<{ name?: string; error?: { message?: string } }>(url, {
    method: 'POST', body, token,
  });
  if (r.status >= 400) {
    const msg = (r.body as { error?: { message?: string } }).error?.message ?? `HTTP ${r.status}`;
    return err(`addVersion failed: ${msg}`, 'secret_add_version_failed');
  }
  const versionName = (r.body as { name?: string }).name ?? 'unknown';
  log.info({ event: 'secret_version_added', version_name: versionName }, 'version added');
  return ok({ version_name: versionName });
};

/* -------------------- secret_access -------------------- */
interface SecretAccessInput { secret_id?: string; version?: string }
interface SecretAccessOutput { value: string; version_name: string }

export const secretAccess: ToolHandler<SecretAccessInput, SecretAccessOutput> = async (
  input,
  deps: ToolHandlerDeps,
) => {
  const i = input as SecretAccessInput;
  const id = String(i?.secret_id ?? '').trim();
  const ver = String(i?.version ?? 'latest').trim();
  if (!SECRET_NAME_RE.test(id)) return err(`invalid secret_id "${id}"`, 'invalid_input');
  const log = deps.logger.child({ tool: 'secret_access', secret_id: id, version: ver });
  const token = await getAccessToken();
  const url = `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${id}/versions/${ver}:access`;
  const r = await apiCall<{ name?: string; payload?: { data?: string }; error?: { message?: string } }>(url, {
    method: 'GET', token,
  });
  if (r.status >= 400) {
    const msg = (r.body as { error?: { message?: string } }).error?.message ?? `HTTP ${r.status}`;
    return err(`access failed: ${msg}`, 'secret_access_failed');
  }
  const b = r.body as { name?: string; payload?: { data?: string } };
  const data = b.payload?.data ?? '';
  const value = Buffer.from(data, 'base64').toString('utf8');
  log.info({ event: 'secret_accessed' }, 'secret accessed');
  return ok({ value, version_name: b.name ?? 'unknown' });
};
