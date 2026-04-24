/**
 * Google OAuth 2.0 authorization-code flow + ID token verification.
 * Uses google-auth-library. Credentials are pulled from Secret Manager
 * at runtime (oauth-client-id, oauth-client-secret).
 * hd claim MUST equal IDSO_ALLOWED_DOMAIN (independencedso.com).
 */
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { getSecret } from './secrets';

export interface IdsoUser {
  email: string;
  name?: string;
  picture?: string;
  idToken: string;
}

export class AuthError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

const GOOGLE_SCOPES = ['openid', 'email', 'profile'];

async function getClient(): Promise<OAuth2Client> {
  const [clientId, clientSecret] = await Promise.all([
    getSecret('oauth-client-id'),
    getSecret('oauth-client-secret'),
  ]);
  const redirectUri = getRedirectUri();
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

export function getRedirectUri(): string {
  const base = process.env.IDSO_APP_URL;
  if (!base) {
    throw new Error('IDSO_APP_URL env var is required (e.g. https://<frontend>.run.app)');
  }
  return `${base.replace(/\/+$/, '')}/api/auth/authorize`;
}

export function getAllowedDomain(): string {
  return process.env.IDSO_ALLOWED_DOMAIN || 'independencedso.com';
}

/**
 * Build the Google authorization URL for initiating login.
 * `state` is a random string the caller stores in a short-lived cookie so
 * /api/auth/authorize can verify the callback was not forged.
 */
export async function buildAuthUrl(state: string): Promise<string> {
  const client = await getClient();
  return client.generateAuthUrl({
    access_type: 'online',
    scope: GOOGLE_SCOPES,
    hd: getAllowedDomain(),
    prompt: 'select_account',
    state,
  });
}

/**
 * Exchange the authorization code for tokens and verify the ID token.
 * Throws AuthError on any validation failure.
 */
export async function exchangeCodeForUser(code: string): Promise<IdsoUser> {
  const client = await getClient();
  const { tokens } = await client.getToken(code);
  const idToken = tokens.id_token;
  if (!idToken) {
    throw new AuthError('no_id_token', 'Google did not return an id_token');
  }

  const clientId = await getSecret('oauth-client-id');
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload) {
    throw new AuthError('invalid_token', 'ID token has no payload');
  }
  return validatePayload(payload, idToken);
}

function validatePayload(payload: TokenPayload, idToken: string): IdsoUser {
  const allowed = getAllowedDomain();
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    throw new AuthError('invalid_issuer', `Token issuer is not Google: ${payload.iss}`);
  }
  if (payload.email_verified !== true) {
    throw new AuthError('email_not_verified', 'Email is not verified by Google');
  }
  if (payload.hd !== allowed) {
    throw new AuthError('wrong_hd', `hd claim must be ${allowed}`);
  }
  if (!payload.email) {
    throw new AuthError('no_email', 'Token has no email claim');
  }
  return {
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    idToken,
  };
}
