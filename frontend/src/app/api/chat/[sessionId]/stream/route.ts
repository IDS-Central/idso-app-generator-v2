import { NextRequest, NextResponse } from 'next/server';
import { buildStreamRequest } from '@/lib/backend';

export const dynamic = 'force-dynamic';
// Use Node runtime so we can stream the fetch response body transparently.
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const upstream = await buildStreamRequest(params.sessionId);
  if (!upstream) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const resp = await fetch(upstream.url, {
    method: 'GET',
    headers: upstream.headers,
    cache: 'no-store',
    // @ts-expect-error - duplex required by node fetch for streaming bodies
    duplex: 'half',
  });

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => '');
    return NextResponse.json(
      { error: 'upstream_error', status: resp.status, body: text.slice(0, 500) },
      { status: resp.status || 502 },
    );
  }

  return new Response(resp.body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
