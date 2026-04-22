/**
 * GET /me
 *
 * Protected endpoint. Returns the verified IDSO user's identity derived purely
 * from the Google ID token attached to the request. Used by the frontend to
 * confirm "am I signed in, and who am I?" and to populate the header avatar.
 *
 * Security: this handler MUST NOT read anything from the request body or query
 * string. The identity comes exclusively from the verified ID token claims.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { createAuth } from '../auth.js';

export interface MeRouteDeps {
    auth: ReturnType<typeof createAuth>;
}

export function registerMeRoute(app: FastifyInstance, deps: MeRouteDeps): void {
    app.get(
          '/me',
      { preHandler: (req: FastifyRequest, rep: FastifyReply) => deps.auth.requireIdsoUser(req, rep) },
          async (request) => {
                  const user = request.user!;
                  request.log.info({ route: '/me' }, 'me_ok');
                  return {
                            email: user.email,
                            name: user.name ?? null,
                            picture: user.picture ?? null,
                  };
          },
        );
}
