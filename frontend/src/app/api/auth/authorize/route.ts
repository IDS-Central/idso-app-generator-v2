/**
 * GET /api/auth/authorize
 * OAuth callback. Verifies state, exchanges code, validates ID token,
 * writes encrypted idso_session cookie, redirects to /.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { AuthError, exchangeCodeForUser } from '@/lib/auth';
import {
  SESSION_COOKIE_NAME,
  SESSION_LIFETIME_MS,
  encryptSession,
} from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'idso_oauth_state';

/**
 * Build absolute URLs from IDSO_APP_URL. Required because behind Cloud Run
 * `request.url` resolves to the container's internal 0.0.0.0:8080 address,
 * which produces unreachable redirect targets.
 */
function publicUrl(path: string, request: NextRequest): URL {
  const base = process.env.IDSO_APP_URL;
  if (base) return new URL(path, base);
  return new URL(path, request.url);
}

function errorRedirect(request: NextRequest, code: string): NextResponse {
  const url = publicUrl('/login', request);
  url.searchParams.set('error', code);
  const response = NextResponse.redirect(url, { status: 302 });
  response.cookies.delete(STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const googleError = url.searchParams.get('error');

  if (googleError) {
    return errorRedirect(request, `google_${googleError}`);
  }

  if (!code || !state) {
    return errorRedirect(request, 'missing_params');
  }

  const stateCookie = request.cookies.get(STATE_COOKIE)?.value;
  if (!stateCookie || stateCookie !== state) {
    return errorRedirect(request, 'state_mismatch');
  }

  try {
    const user = await exchangeCodeForUser(code);

    const now = Date.now();
    const cookieValue = encryptSession({
      email: user.email,
      name: user.name,
      picture: user.picture,
      idToken: user.idToken,
      issuedAt: now,
      expiresAt: now + SESSION_LIFETIME_MS,
    });

    const dest = publicUrl('/', request);
    const response = NextResponse.redirect(dest, { status: 302 });
    response.cookies.delete(STATE_COOKIE);
    response.cookies.set(SESSION_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(SESSION_LIFETIME_MS / 1000),
    });
    return response;
  } catch (err) {
    const errCode = err instanceof AuthError ? err.code : 'exchange_failed';
    console.error('OAuth authorize failure', { code: errCode, message: (err as Error).message });
    return errorRedirect(request, errCode);
  }
}
