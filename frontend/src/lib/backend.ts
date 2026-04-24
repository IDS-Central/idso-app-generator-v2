/**
 * Typed client for the backend (idso-app-generator-v2-backend-*).
 * Forwards the user's Google ID token as Authorization: Bearer <idToken>.
 * The backend re-verifies the token against Google's JWKs on every call.
 *
 * Server-side only (reads the session cookie). Do NOT import from client
 * components.
 */
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from './session-constants';
import { decryptSession } from './session';

export interface BackendError {
  status: number;
  body: unknown;
}

function backendBaseUrl(): string {
  const base = process.env.IDSO_BACKEND_URL;
  if (!base) {
    throw new Error('IDSO_BACKEND_URL env var is required');
  }
  return base.replace(/\/+$/, '');
}

async function getIdToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  const session = decryptSession(raw);
  return session?.idToken ?? null;
}

export async function backendFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const idToken = await getIdToken();
  if (!idToken) {
    throw { status: 401, body: { error: 'unauthenticated' } } satisfies BackendError;
  }

  const url = `${backendBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${idToken}`);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw { status: response.status, body } satisfies BackendError;
  }
  return body as T;
}

/** GET /me on the backend - useful for sanity-checking the token forward path. */
export async function backendMe(): Promise<{ email: string; name?: string | null; picture?: string | null }> {
  return backendFetch('/me');
}
