import { NextRequest, NextResponse } from 'next/server';
import { sendTurn } from '@/lib/backend';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const body = (await req.json()) as { message: string };
    if (!body?.message || typeof body.message !== 'string') {
      return NextResponse.json({ error: 'message_required' }, { status: 400 });
    }
    const result = await sendTurn(params.sessionId, body);
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
