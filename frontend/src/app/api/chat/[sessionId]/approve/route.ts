import { NextRequest, NextResponse } from 'next/server';
import { approveTurn } from '@/lib/backend';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      turnNumber?: number;
      approved?: boolean;
    };
    const result = await approveTurn(params.sessionId, {
      turnNumber: body.turnNumber ?? 0,
      approved: body.approved ?? true,
    });
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
