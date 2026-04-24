/**
 * Edge middleware. Runs on every request except static assets.
 * Enforces that /api/* and page routes have a valid session cookie.
 * Exceptions: PUBLIC_ROUTES list below.
 *
 * Behavior:
 *   - API request without valid session: 401 JSON
 *   - Page request without valid session: 302 redirect to /login
 */
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session-constants';
import { decryptSessionEdge } from '@/lib/session-edge';

const PUBLIC_PAGE_ROUTES = new Set<string>(['/login']);
const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/health'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PAGE_ROUTES.has(pathname)) return true;
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix)) return true;
  }
  return false;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let session = null as Awaited<ReturnType<typeof decryptSessionEdge>>;
  let decryptError: string | null = null;
  if (cookie) {
    try {
      session = await decryptSessionEdge(cookie);
    } catch (err) {
      decryptError = (err as Error)?.message ?? String(err);
    }
  }

  if (session) {
    return NextResponse.next();
  }

  // DIAGNOSTIC: one-line log when middleware decides to bounce to /login.
  // Shows whether cookie was present, its length, whether decrypt threw, and whether secret key env exists.
  console.log(JSON.stringify({
    evt: 'mw_bounce',
    path: pathname,
    cookie_present: Boolean(cookie),
    cookie_len: cookie ? cookie.length : 0,
    decrypt_err: decryptError,
    session_null_reason: !cookie ? 'no_cookie' : (decryptError ? 'decrypt_threw' : 'returned_null'),
    secret_key_set: Boolean(process.env.SECRET_KEY),
    secret_key_len: process.env.SECRET_KEY ? process.env.SECRET_KEY.length : 0,
  }));

  // Unauthenticated: API -> 401 JSON, page -> redirect to /login
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl, { status: 302 });
}

export const config = {
  // Match everything except Next.js internals, static files, and favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
