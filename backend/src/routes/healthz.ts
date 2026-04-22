/**
 * GET /healthz
 *
 * Unauthenticated liveness probe for Cloud Run. Returns 200 if the process is up.
 * Does NOT check Secret Manager, Anthropic, or GitHub — those are verified once at
 * startup; if any of them fail, the process exits non-zero and this route is never
 * served.
 */

import type { FastifyInstance } from 'fastify';

export function registerHealthzRoute(app: FastifyInstance): void {
    app.get('/healthz', async () => {
          return { status: 'ok' };
    });
}
