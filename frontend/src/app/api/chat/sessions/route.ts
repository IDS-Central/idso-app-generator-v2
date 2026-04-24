import { NextRequest, NextResponse } from 'next/server';
import { startSession, listSessions } from '@/lib/backend';

export const dynamic = 'force-dynamic';

function errorResponse(err: unknown) {
  const status =
    typeof err === 'object' && err && 'status' in err && typeof err.status === 'number'
      ? err.status
      : 500;
  const body =
    typeof err === 'object' && err && 'body' in err ? err.body : { error: 'internal' };
  return NextResponse.json(body, { status });
}

export async function GET(req: NextRequest) {
  try {
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(200, Number(limitParam) || 50)) : 50;
    const result = await listSessions(limit);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { title?: string };
    const result = await startSession(body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
