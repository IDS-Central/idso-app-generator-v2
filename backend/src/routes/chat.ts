/**
 * Chat routes: create sessions, submit user turns, approve paused write tools,
 * and stream agent-loop progress over SSE.
 *
 * Endpoints (all require a verified IDSO ID token):
 *   POST /v1/chat/sessions                  -> { session_id }
 *   POST /v1/chat/:sessionId/turn           -> run loop, return LoopResult (sync)
 *   POST /v1/chat/:sessionId/approve        -> approve a paused tool_use_id
 *   GET  /v1/chat/:sessionId/stream         -> SSE: replay existing turns then keep-alive
 *
 * The SSE stream in this commit is intentionally minimal  it replays turn
 * history and heartbeats every 15s. Live token streaming out of runAgentLoop is
 * a later improvement; the sync POST /turn endpoint is already functional end
 * to end.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type Anthropic from '@anthropic-ai/sdk';
import type { Logger } from 'pino';
import type { createAuth } from '../auth.js';
import type { SessionStore, TurnRole } from '../session/store.js';
import type { ToolHandlerDeps } from '../tools/types.js';
import { runAgentLoop, type LoopResult } from '../agent/loop.js';

export interface ChatRouteDeps {
  auth: ReturnType<typeof createAuth>;
  anthropic: Anthropic;
  store: SessionStore;
  toolDeps: ToolHandlerDeps;
  logger: Logger;
  systemPrompt: string;
  /**
   * DEV-ONLY auth bypass.  When populated the routes will accept a request
   * carrying header `x-dev-auth-bypass: 1` as the configured email, skipping
   * the real Google ID token check.  Must remain null in production.
   */
  devBypass?: { email: string } | null;
}

interface TurnBody {
  message: string;
}

interface ApproveBody {
  tool_use_id: string;
  decision: 'approved' | 'rejected';
  note?: string;
}

export function registerChatRoutes(app: FastifyInstance, deps: ChatRouteDeps): void {
  /**
   * preHandler used by every chat route.  In production this delegates
   * straight to deps.auth.requireIdsoUser().  In dev, when deps.devBypass is
   * set AND the request carries header `x-dev-auth-bypass: 1`, we synthesise
   * a user from the bypass email and log a WARN on every hit so it cannot
   * slip silently into production.
   */
  const requireUser = async (req: FastifyRequest, rep: FastifyReply): Promise<void> => {
    if (deps.devBypass && req.headers['x-dev-auth-bypass'] === '1') {
      const email = deps.devBypass.email;
      req.user = { email, name: 'dev-bypass', picture: undefined };
      req.log = req.log.child({ authenticated_email: email, auth_mode: 'dev_bypass' });
      req.log.warn({ email, route: req.url }, 'auth_dev_bypass_used');
      return;
    }
    return deps.auth.requireIdsoUser(req, rep);
  };

  const log = deps.logger.child({ component: 'chat_routes' });

  // -- GET /v1/chat/sessions (list recent sessions for this user) -------------
  app.get(
    '/v1/chat/sessions',
    { preHandler: requireUser },
    async (req, rep) => {
      const user = req.user;
      if (!user) {
        return rep.code(401).send({ error: 'unauthenticated' });
      }
      const limitParam = (req.query as { limit?: string })?.limit;
      const limit = Math.max(1, Math.min(200, Number(limitParam) || 50));
      const rows = await deps.store.listSessionsForUser(user.email, limit);
      return rep.send({ sessions: rows });
    },
  );

  // -- POST /v1/chat/sessions ---------------------------------------------
  app.post(
    '/v1/chat/sessions',
    { preHandler: requireUser },
    async (req: FastifyRequest, rep: FastifyReply) => {
      const user = req.user;
      if (!user) {
        return rep.code(401).send({ error: 'unauthenticated' });
      }
      const row = await deps.store.createSession({ user_email: user.email });
      log.info({ session_id: row.session_id, user: user.email }, 'chat_session_created');
      return rep.code(201).send({ session_id: row.session_id });
    },
  );

  // -- POST /v1/chat/:sessionId/turn --------------------------------------
  app.post<{ Params: { sessionId: string }; Body: TurnBody }>(
    '/v1/chat/:sessionId/turn',
    { preHandler: requireUser },
    async (req, rep) => {
      const user = req.user;
      if (!user) {
        return rep.code(401).send({ error: 'unauthenticated' });
      }
      const { sessionId } = req.params;
      const { message } = req.body ?? {};
      if (typeof message !== 'string' || message.trim().length === 0) {
        return rep.code(400).send({ error: 'message_required' });
      }

      const session = await deps.store.getSession(sessionId);
      if (!session) return rep.code(404).send({ error: 'session_not_found' });
      if (session.user_email !== user.email) {
        return rep.code(403).send({ error: 'session_owner_mismatch' });
      }

      await deps.store.appendTurn({
        session_id: sessionId,
        role: 'user' as TurnRole,
        content: message,
      });
      await deps.store.touchSession(sessionId);

      const result: LoopResult = await runAgentLoop(
        {
          anthropic: deps.anthropic,
          logger: deps.logger,
          store: deps.store,
          toolDeps: deps.toolDeps,
          systemPrompt: deps.systemPrompt,
        },
        sessionId,
      );

      log.info({ session_id: sessionId, status: result.status, iter: result.iterations }, 'chat_turn_completed');
      return rep.send(result);
    },
  );

  // -- POST /v1/chat/:sessionId/approve -----------------------------------
  app.post<{ Params: { sessionId: string }; Body: ApproveBody }>(
    '/v1/chat/:sessionId/approve',
    { preHandler: requireUser },
    async (req, rep) => {
      const user = req.user;
      if (!user) {
        return rep.code(401).send({ error: 'unauthenticated' });
      }
      const { sessionId } = req.params;
      const { tool_use_id, decision, note } = req.body ?? ({} as ApproveBody);
      if (!tool_use_id || (decision !== 'approved' && decision !== 'rejected')) {
        return rep.code(400).send({ error: 'bad_approval_body' });
      }

      const session = await deps.store.getSession(sessionId);
      if (!session) return rep.code(404).send({ error: 'session_not_found' });
      if (session.user_email !== user.email) {
        return rep.code(403).send({ error: 'session_owner_mismatch' });
      }

      await deps.store.appendTurn({
        session_id: sessionId,
        role: 'approval' as TurnRole,
        content: { tool_use_id, decision, note: note ?? null, approver: user.email },
        tool_use_id,
        approval_state: decision,
      });

      log.info({ session_id: sessionId, tool_use_id, decision, user: user.email }, 'chat_approval_recorded');

      if (decision !== 'approved') {
        return rep.send({ status: 'rejected', tool_use_id });
      }

      // Resume the loop now that the approval is persisted.
      const result: LoopResult = await runAgentLoop(
        {
          anthropic: deps.anthropic,
          logger: deps.logger,
          store: deps.store,
          toolDeps: deps.toolDeps,
          systemPrompt: deps.systemPrompt,
        },
        sessionId,
      );
      return rep.send(result);
    },
  );

  // -- GET /v1/chat/:sessionId/stream (SSE replay + heartbeat) ------------
  app.get<{ Params: { sessionId: string } }>(
    '/v1/chat/:sessionId/stream',
    { preHandler: requireUser },
    async (req, rep) => {
      const user = req.user;
      if (!user) {
        return rep.code(401).send({ error: 'unauthenticated' });
      }
      const { sessionId } = req.params;

      const session = await deps.store.getSession(sessionId);
      if (!session) return rep.code(404).send({ error: 'session_not_found' });
      if (session.user_email !== user.email) {
        return rep.code(403).send({ error: 'session_owner_mismatch' });
      }

      rep.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const send = (event: string, data: unknown) => {
        rep.raw.write(`event: ${event}\n`);
        rep.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Replay existing turn history so the client can render the full chat.
      const turns = await deps.store.getTurns(sessionId);
      for (const t of turns) {
        send('turn', t);
      }
      send('replay_complete', { count: turns.length });

      // Heartbeat keeps Cloud Run / intermediary proxies from timing out.
      const hb = setInterval(() => {
        try {
          rep.raw.write(`: heartbeat ${Date.now()}\n\n`);
        } catch {
          clearInterval(hb);
        }
      }, 15_000);

      req.raw.on('close', () => {
        clearInterval(hb);
        try {
          rep.raw.end();
        } catch {
          // already closed
        }
        log.info({ session_id: sessionId }, 'chat_stream_closed');
      });

      // Keep the request open  Fastify won't auto-close because we took over rep.raw.
      return rep;
    },
  );
}
