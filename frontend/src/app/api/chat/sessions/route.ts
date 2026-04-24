import { NextRequest, NextResponse } from 'next/server';
import { startSession } from '@/lib/backend';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { title?: string };
    const result = await startSession(body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const status =
      typeof err === 'object' && err && 'status' in err && typeof err.status === 'number'
        ? err.status
        : 500;
    const body = typeof err === 'object' && err && 'body' in err ? err.body : { error: 'internal' };
    return NextResponse.json(body, { status });
  }
}
