/**
 * POST /api/auth/logout (also accepts GET for convenience)
 * Clears the session cookie and redirects to /login.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clearAndRedirect(request: NextRequest): NextResponse {
  const url = new URL('/login', request.url);
  const response = NextResponse.redirect(url, { status: 302 });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return clearAndRedirect(request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return clearAndRedirect(request);
}
