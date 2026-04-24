/**
 * GET /api/health - liveness/readiness probe. No auth required.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: 'ok', service: 'idso-app-generator-v2-frontend' });
}
