/**
 * OAuth client tools.
 *
 * oauth_add_redirect_uri: adds a redirect URI to an existing GCP OAuth 2.0
 *   Client (so that generated apps can complete their OAuth flows after a
 *   new Cloud Run URL is provisioned). Uses the modern IAM OAuth Clients
 *   API: projects/{project}/locations/global/oauthClients/{client}.
 *
 * The tool performs a GET  merge  PATCH with field mask
 * "allowedRedirectUris" to avoid clobbering unrelated fields. Idempotent
 * if the URI is already present.
 *
 * Note: the legacy Cloud Console OAuth consent screen brand/client endpoints
 * under iap.googleapis.com or apikeys.googleapis.com are NOT used here 
 * those are read-only from outside the console. The new IAM OAuth client
 * endpoint is the supported write path.
 */
import { GoogleAuth } from 'google-auth-library';
import type { ToolHandler, ToolHandlerDeps } from './types.js';
import { ok, err } from './types.js';

const PROJECT_ID = 'reconciliation-dashboard';
const CLIENT_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const URI_RE = /^https?:\/\/[^\s]{1,2000}$/;

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  if (!t.token) throw new Error('no access token');
  return t.token;
}

interface OauthAddRedirectUriInput { client_id?: string; redirect_uri?: string }
interface OauthAddRedirectUriOutput {
  client_resource_name: string;
  redirect_uris: string[];
  already_present: boolean;
}

export const oauthAddRedirectUri: ToolHandler<OauthAddRedirectUriInput, OauthAddRedirectUriOutput> = async (
  input,
  deps: ToolHandlerDeps,
) => {
  const i = input as OauthAddRedirectUriInput;
  const clientId = String(i?.client_id ?? '').trim();
  const uri = String(i?.redirect_uri ?? '').trim();
  if (!CLIENT_ID_RE.test(clientId)) return err(`invalid client_id "${clientId}"`, 'invalid_input');
  if (!URI_RE.test(uri)) return err(`invalid redirect_uri (must be http(s)://...) "${uri}"`, 'invalid_input');
  const log = deps.logger.child({ tool: 'oauth_add_redirect_uri', client_id: clientId, redirect_uri: uri });
  const token = await getAccessToken();
  const resource = `projects/${PROJECT_ID}/locations/global/oauthClients/${clientId}`;
  const base = `https://iam.googleapis.com/v1/${resource}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // GET current state
  const getRes = await fetch(base, { method: 'GET', headers });
  const getText = await getRes.text();
  if (getRes.status >= 400) {
    return err(`failed to get OAuth client: HTTP ${getRes.status}: ${getText.slice(0, 300)}`,
               getRes.status === 404 ? 'client_not_found' : 'oauth_get_failed');
  }
  let current: { allowedRedirectUris?: string[] } = {};
  try { current = JSON.parse(getText) as typeof current; } catch { /* ignore */ }
  const existing = current.allowedRedirectUris ?? [];
  if (existing.includes(uri)) {
    log.info({ event: 'oauth_uri_already_present', count: existing.length }, 'redirect_uri already in list');
    return ok({ client_resource_name: resource, redirect_uris: existing, already_present: true });
  }
  const merged = [...existing, uri];

  // PATCH with field mask
  const patchUrl = `${base}?updateMask=allowedRedirectUris`;
  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ allowedRedirectUris: merged }),
  });
  const patchText = await patchRes.text();
  if (patchRes.status >= 400) {
    return err(`failed to patch OAuth client: HTTP ${patchRes.status}: ${patchText.slice(0, 300)}`,
               'oauth_patch_failed');
  }
  let patched: { allowedRedirectUris?: string[] } = {};
  try { patched = JSON.parse(patchText) as typeof patched; } catch { /* ignore */ }
  const finalList = patched.allowedRedirectUris ?? merged;
  log.info({ event: 'oauth_uri_added', final_count: finalList.length }, 'redirect_uri added');
  return ok({ client_resource_name: resource, redirect_uris: finalList, already_present: false });
};
