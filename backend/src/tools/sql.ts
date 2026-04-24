/**
 * Cloud SQL tools.
 *
 * sql_create_instance: creates a Cloud SQL for PostgreSQL instance with a
 *   sensible small-footprint default. Long-running; returns the operation
 *   name. Idempotent on ALREADY_EXISTS.
 * sql_create_database: creates a database inside an existing instance.
 *   Idempotent on ALREADY_EXISTS.
 * sql_create_user: creates a Cloud SQL IAM user (or built-in user with
 *   password) on an existing instance. Idempotent on ALREADY_EXISTS.
 *
 * Uses Cloud SQL Admin API v1 (sqladmin.googleapis.com). The runtime SA
 * needs roles/cloudsql.admin to succeed. The tool returns structured
 * errors if IAM is insufficient so the caller can surface the exact
 * missing permission.
 */
import { GoogleAuth } from 'google-auth-library';
import type { ToolHandler, ToolHandlerDeps } from './types.js';
import { ok, err } from './types.js';

const PROJECT_ID = 'reconciliation-dashboard';
const REGION = 'us-central1';
const INSTANCE_RE = /^[a-z][a-z0-9-]{0,79}$/;
const DB_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;
const USER_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_.-]{0,62}$/;

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  if (!t.token) throw new Error('no access token');
  return t.token;
}

async function sqlAdminCall<T>(
  path: string,
  method: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const url = `https://sqladmin.googleapis.com/sql/v1beta4/projects/${PROJECT_ID}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let j: unknown = {};
  try { j = text ? JSON.parse(text) : {}; } catch { j = { raw: text }; }
  return { status: res.status, body: j as T };
}

interface SqlError { error?: { message?: string; status?: string; code?: number } }

/* -------------------- sql_create_instance -------------------- */
interface SqlCreateInstanceInput {
  instance_name?: string;
  tier?: string;
  database_version?: string;
  root_password?: string;
}
interface SqlCreateInstanceOutput {
  instance_name: string;
  operation_name: string;
  state: 'PENDING_CREATE' | 'ALREADY_EXISTS';
  note: string;
}

export const sqlCreateInstance: ToolHandler<SqlCreateInstanceInput, SqlCreateInstanceOutput> = async (
  input,
  deps: ToolHandlerDeps,
) => {
  const i = input as SqlCreateInstanceInput;
  const name = String(i?.instance_name ?? '').trim();
  const tier = String(i?.tier ?? 'db-f1-micro');
  const dbVersion = String(i?.database_version ?? 'POSTGRES_15');
  const rootPassword = String(i?.root_password ?? '');
  if (!INSTANCE_RE.test(name)) return err(`invalid instance_name "${name}"`, 'invalid_input');
  if (!/^db-[a-z0-9-]{2,60}$/.test(tier)) return err(`invalid tier "${tier}"`, 'invalid_input');
  if (!/^POSTGRES_[0-9]{2}$|^MYSQL_[0-9]_[0-9]$/.test(dbVersion)) return err(`invalid database_version "${dbVersion}"`, 'invalid_input');
  if (rootPassword.length < 12 || rootPassword.length > 128) return err('root_password must be 12..128 chars', 'invalid_input');

  const log = deps.logger.child({ tool: 'sql_create_instance', instance_name: name, tier, database_version: dbVersion });
  const token = await getAccessToken();
  const body = {
    name,
    region: REGION,
    databaseVersion: dbVersion,
    rootPassword,
    settings: {
      tier,
      edition: 'ENTERPRISE',
      backupConfiguration: { enabled: true, startTime: '03:00' },
      ipConfiguration: { ipv4Enabled: true, requireSsl: true },
      deletionProtectionEnabled: false,
    },
  };
  const r = await sqlAdminCall<{ name?: string } & SqlError>('/instances', 'POST', token, body);
  if (r.status === 409 || r.body.error?.status === 'ALREADY_EXISTS') {
    log.info({ event: 'sql_instance_already_exists' }, 'instance already existed; continuing');
    return ok({ instance_name: name, operation_name: '', state: 'ALREADY_EXISTS', note: 'instance already existed' });
  }
  if (r.status >= 400) {
    const msg = r.body.error?.message ?? `HTTP ${r.status}`;
    const code = r.body.error?.status === 'PERMISSION_DENIED' ? 'permission_denied' : 'sql_instance_create_failed';
    return err(`failed to create Cloud SQL instance: ${msg}`, code);
  }
  const opName = r.body.name ?? '';
  log.info({ event: 'sql_instance_create_started', operation_name: opName }, 'instance creation started');
  return ok({
    instance_name: name,
    operation_name: opName,
    state: 'PENDING_CREATE',
    note: 'Instance creation typically takes 510 minutes. Poll Cloud SQL Admin for completion.',
  });
};

/* -------------------- sql_create_database -------------------- */
interface SqlCreateDatabaseInput { instance_name?: string; database_name?: string }
interface SqlCreateDatabaseOutput { instance_name: string; database_name: string; already_existed: boolean }

export const sqlCreateDatabase: ToolHandler<SqlCreateDatabaseInput, SqlCreateDatabaseOutput> = async (
  input,
  deps: ToolHandlerDeps,
) => {
  const i = input as SqlCreateDatabaseInput;
  const inst = String(i?.instance_name ?? '').trim();
  const db = String(i?.database_name ?? '').trim();
  if (!INSTANCE_RE.test(inst)) return err(`invalid instance_name "${inst}"`, 'invalid_input');
  if (!DB_NAME_RE.test(db)) return err(`invalid database_name "${db}"`, 'invalid_input');
  const log = deps.logger.child({ tool: 'sql_create_database', instance_name: inst, database_name: db });
  const token = await getAccessToken();
  const r = await sqlAdminCall<SqlError>(`/instances/${encodeURIComponent(inst)}/databases`, 'POST', token, { name: db });
  if (r.status === 409 || r.body.error?.status === 'ALREADY_EXISTS') {
    log.info({ event: 'sql_db_already_exists' }, 'database already existed');
    return ok({ instance_name: inst, database_name: db, already_existed: true });
  }
  if (r.status >= 400) {
    const msg = r.body.error?.message ?? `HTTP ${r.status}`;
    return err(`failed to create database: ${msg}`, 'sql_db_create_failed');
  }
  log.info({ event: 'sql_db_created' }, 'database created');
  return ok({ instance_name: inst, database_name: db, already_existed: false });
};

/* -------------------- sql_create_user -------------------- */
interface SqlCreateUserInput { instance_name?: string; user_name?: string; password?: string; iam_email?: string }
interface SqlCreateUserOutput { instance_name: string; user_name: string; type: string; already_existed: boolean }

export const sqlCreateUser: ToolHandler<SqlCreateUserInput, SqlCreateUserOutput> = async (
  input,
  deps: ToolHandlerDeps,
) => {
  const i = input as SqlCreateUserInput;
  const inst = String(i?.instance_name ?? '').trim();
  const iamEmail = i?.iam_email ? String(i.iam_email).trim() : '';
  const userName = String(i?.user_name ?? iamEmail).trim();
  const password = i?.password ? String(i.password) : '';
  if (!INSTANCE_RE.test(inst)) return err(`invalid instance_name "${inst}"`, 'invalid_input');
  let userType: string;
  let body: Record<string, unknown>;
  if (iamEmail) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(iamEmail)) return err(`invalid iam_email "${iamEmail}"`, 'invalid_input');
    userType = iamEmail.endsWith('.gserviceaccount.com') ? 'CLOUD_IAM_SERVICE_ACCOUNT' : 'CLOUD_IAM_USER';
    body = { name: iamEmail, type: userType };
  } else {
    if (!USER_NAME_RE.test(userName)) return err(`invalid user_name "${userName}"`, 'invalid_input');
    if (password.length < 12 || password.length > 128) return err('password must be 12..128 chars', 'invalid_input');
    userType = 'BUILT_IN';
    body = { name: userName, password };
  }
  const log = deps.logger.child({ tool: 'sql_create_user', instance_name: inst, user_name: userName, type: userType });
  const token = await getAccessToken();
  const r = await sqlAdminCall<SqlError>(`/instances/${encodeURIComponent(inst)}/users`, 'POST', token, body);
  if (r.status === 409 || r.body.error?.status === 'ALREADY_EXISTS') {
    log.info({ event: 'sql_user_already_exists' }, 'user already existed');
    return ok({ instance_name: inst, user_name: userName, type: userType, already_existed: true });
  }
  if (r.status >= 400) {
    const msg = r.body.error?.message ?? `HTTP ${r.status}`;
    return err(`failed to create user: ${msg}`, 'sql_user_create_failed');
  }
  log.info({ event: 'sql_user_created' }, 'user created');
  return ok({ instance_name: inst, user_name: userName, type: userType, already_existed: false });
};
