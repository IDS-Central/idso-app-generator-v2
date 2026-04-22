/**
 * Google ID token verification for every authenticated request.
 *
 * Every protected route runs through `requireIdsoUser`, which:
 *   1. Pulls the bearer token from the Authorization header.
 *   2. Verifies the Google-issued ID token against the OAuth client id audience.
 *   3. Asserts hd === config.allowedHd ('independencedso.com').
 *   4. Asserts email_verified === true.
 *   5. Attaches { email, name, picture } to the request and returns it to downstream
 *      handlers via `request.user`.
 *
 * There is no user table. The verified email IS the user identity for the entire
 * backend (per D-001 in docs/DECISIONS.md).
 *
 * Rejections return 401 with a short machine-readable code. We never echo the
 * offending token back and never log the token itself.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import type { Config } from './config.js';

export interface IdsoUser {
    email: string;
    name: string | undefined;
    picture: string | undefined;
}

declare module 'fastify' {
    interface FastifyRequest {
          user?: IdsoUser;
    }
}

export interface AuthDeps {
    config: Config;
    oauthClientId: string;
}

export function createAuth(deps: AuthDeps) {
    const client = new OAuth2Client(deps.oauthClientId);

  async function verify(rawToken: string): Promise<IdsoUser> {
        const ticket = await client.verifyIdToken({
                idToken: rawToken,
                audience: deps.oauthClientId,
        });
        const payload = ticket.getPayload();
        if (!payload) {
                throw new AuthError('invalid_token', 'Token has no payload');
        }
        if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
                throw new AuthError('invalid_issuer', 'Token issuer is not Google');
        }
        if (payload.email_verified !== true) {
                throw new AuthError('email_not_verified', 'Email is not verified by Google');
        }
        if (payload.hd !== deps.config.allowedHd) {
                throw new AuthError('wrong_hd', `hd claim must be ${deps.config.allowedHd}`);
        }
        if (!payload.email) {
                throw new AuthError('no_email', 'Token has no email claim');
        }
        return {
                email: payload.email,
                name: payload.name,
                picture: payload.picture,
        };
  }

  async function requireIdsoUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const header = request.headers.authorization;
        if (!header || !header.toLowerCase().startsWith('bearer ')) {
                reply.code(401).send({ error: 'missing_bearer' });
                return;
        }
        const token = header.slice('bearer '.length).trim();
        if (!token) {
                reply.code(401).send({ error: 'empty_bearer' });
                return;
        }
        try {
                const user = await verify(token);
                request.user = user;
                // Replace the request logger with a child bound to the authenticated email,
          // so every downstream log line for this request includes it.
          request.log = request.log.child({ authenticated_email: user.email });
        } catch (err) {
                const code = err instanceof AuthError ? err.code : 'verify_failed';
                request.log.warn({ auth_error: code }, 'id_token_rejected');
                reply.code(401).send({ error: code });
        }
  }

  return { requireIdsoUser, verify };
}

export class AuthError extends Error {
    public override readonly name = 'AuthError';
    constructor(
          public readonly code: string,
          message: string,
        ) {
          super(message);
    }
}
