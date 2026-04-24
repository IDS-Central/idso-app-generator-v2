/**
 * GET /api/auth/me
 * Returns { email, name, picture } for the authenticated user.
 * 401 JSON if no valid session cookie. Never returns the id_token.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const session = decryptSession(raw);
  if (!session) {
    return NextResponse.json({ error: 'invalid_session' }, { status: 401 });
  }
  return NextResponse.json({
    data: {
      email: session.email,
      name: session.name ?? null,
      picture: session.picture ?? null,
    },
  });
}
