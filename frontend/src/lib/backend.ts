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

export function backendBaseUrl(): string {
  const base = process.env.IDSO_BACKEND_URL;
  if (!base) {
    throw new Error('IDSO_BACKEND_URL env var is required');
  }
  return base.replace(/\/+$/, '');
}

export async function getIdToken(): Promise<string | null> {
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

/** Chat types mirrored from backend/src/types.ts (kept loose on purpose). */
export interface StartSessionResponse {
  sessionId: string;
}

export interface TurnResponse {
  turnNumber: number;
  role: 'assistant';
  content: string;
  toolCalls?: unknown[];
  pendingApproval?: boolean;
}

export interface ApproveResponse {
  ok: true;
  turnNumber: number;
}

export async function startSession(body: { title?: string } = {}): Promise<StartSessionResponse> {
  return backendFetch<StartSessionResponse>('/v1/chat/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function sendTurn(
  sessionId: string,
  body: { message: string },
): Promise<TurnResponse> {
  return backendFetch<TurnResponse>(`/v1/chat/${encodeURIComponent(sessionId)}/turn`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function approveTurn(
  sessionId: string,
  body: { turnNumber: number; approved: boolean } = { turnNumber: 0, approved: true },
): Promise<ApproveResponse> {
  return backendFetch<ApproveResponse>(`/v1/chat/${encodeURIComponent(sessionId)}/approve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Build the upstream SSE URL + Bearer headers, for use by the Next.js proxy route. */
export async function buildStreamRequest(
  sessionId: string,
): Promise<{ url: string; headers: Record<string, string> } | null> {
  const idToken = await getIdToken();
  if (!idToken) return null;
  const url = `${backendBaseUrl()}/v1/chat/${encodeURIComponent(sessionId)}/stream`;
  return { url, headers: { authorization: `Bearer ${idToken}`, accept: 'text/event-stream' } };
}

export interface SessionListItem {
  sessionId: string;
  title: string | null;
  lastActivityAt: string;
  createdAt: string;
}

export async function listSessions(limit = 50): Promise<{ sessions: SessionListItem[] }> {
  return backendFetch<{ sessions: SessionListItem[] }>(`/v1/chat/sessions?limit=${limit}`);
}
