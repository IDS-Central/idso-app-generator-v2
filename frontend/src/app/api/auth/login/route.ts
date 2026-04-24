/**
 * GET /api/auth/login
 * Initiates Google OAuth 2.0 login.
 * 1. Generate a random `state` value (32 bytes hex).
 * 2. Set it in a short-lived, HttpOnly cookie.
 * 3. Redirect to Google's authorization URL with that state.
 * /api/auth/authorize will verify the state on callback.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { buildAuthUrl } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'idso_oauth_state';
const STATE_TTL_SECONDS = 10 * 60; // 10 minutes

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const state = randomBytes(32).toString('hex');
  const authUrl = await buildAuthUrl(state);
  const response = NextResponse.redirect(authUrl, { status: 302 });
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  });
  return response;
}
