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
  const session = cookie ? await decryptSessionEdge(cookie) : null;

  if (session) {
    return NextResponse.next();
  }

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
