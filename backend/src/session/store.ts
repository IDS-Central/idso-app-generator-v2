/**
 * BigQuery-backed session store for the generator.
 *
 * Two tables, defined in schema.sql:
 *   - sessions  : one row per chat conversation
 *   - turns     : append-only log of every user/assistant/tool_* row
 *
 * Writes go through `bq.dataset(...).table(...).insert(...)` which uses
 * the streaming insert API (immediate visibility, small rows, no slot
 * cost for reads). Reads are ordinary `bq.query(...)` calls.
 *
 * The store is deliberately thin: no transactions, no cross-table
 * locking. The generator never updates a turn after writing it \u2014 all
 * state transitions (e.g. approval pending \u2192 approved) are new rows
 * with a later turn_number, so the log stays append-only and trivially
 * replay-safe.
 */

import { randomUUID } from 'node:crypto';
import type { BigQuery } from '@google-cloud/bigquery';
import type { Logger } from 'pino';

export type SessionState = 'active' | 'completed' | 'abandoned';
export type TurnRole =
  | 'user'
  | 'assistant'
  | 'tool_call'
  | 'tool_result'
  | 'approval';
export type ApprovalState = 'pending' | 'approved' | 'rejected';

export type SessionRow = {
  session_id: string;
  user_email: string;
  title: string | null;
  state: SessionState;
  created_at: string; // ISO-8601 from BQ
  last_activity_at: string;
};

export type TurnRow = {
  turn_id: string;
  session_id: string;
  turn_number: number;
  role: TurnRole;
  tool_name: string | null;
  tool_use_id: string | null;
  approval_state: ApprovalState | null;
  content: unknown; // parsed JSON payload
  created_at: string;
};

export type AppendTurnInput = {
  session_id: string;
  role: TurnRole;
  content: unknown;
  tool_name?: string | null;
  tool_use_id?: string | null;
  approval_state?: ApprovalState | null;
};

export type StoreDeps = {
  bq: BigQuery;
  logger: Logger;
  project: string;
  dataset: string;
};

export class SessionStore {
  private readonly bq: BigQuery;
  private readonly log: Logger;
  private readonly project: string;
  private readonly dataset: string;

  constructor(deps: StoreDeps) {
    this.bq = deps.bq;
    this.log = deps.logger.child({ component: 'session_store' });
    this.project = deps.project;
    this.dataset = deps.dataset;
  }

  /* ---------- sessions ---------- */

  async createSession(params: {
    user_email: string;
    title?: string | null;
  }): Promise<SessionRow> {
    const now = new Date();
    const row: SessionRow = {
      session_id: randomUUID(),
      user_email: params.user_email,
      title: params.title ?? null,
      state: 'active',
      created_at: now.toISOString(),
      last_activity_at: now.toISOString(),
    };
    await this.bq
      .dataset(this.dataset, { projectId: this.project })
      .table('sessions')
      .insert([row]);
    this.log.info(
      { session_id: row.session_id, user_email: row.user_email },
      'session_created',
    );
    return row;
  }

  async getSession(sessionId: string): Promise<SessionRow | null> {
    const sql = `
      SELECT session_id, user_email, title, state,
             FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6SZ', created_at) AS created_at,
             FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6SZ', last_activity_at) AS last_activity_at
      FROM \`${this.project}.${this.dataset}.sessions\`
      WHERE session_id = @session_id
      ORDER BY last_activity_at DESC
      LIMIT 1
    `;
    const [rows] = await this.bq.query({
      query: sql,
      params: { session_id: sessionId },
    });
    return (rows[0] as SessionRow | undefined) ?? null;
  }

  /**
   * "Update" the session's state + last_activity_at by appending a new
   * row with the same session_id (append-only; latest row wins via the
   * ORDER BY in getSession).
   */
  async touchSession(
    sessionId: string,
    patch: { state?: SessionState; title?: string | null } = {},
  ): Promise<void> {
    const existing = await this.getSession(sessionId);
    if (!existing) throw new Error(`session not found: ${sessionId}`);
    const now = new Date().toISOString();
    const row: SessionRow = {
      ...existing,
      ...(patch.state ? { state: patch.state } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      last_activity_at: now,
    };
    await this.bq
      .dataset(this.dataset, { projectId: this.project })
      .table('sessions')
      .insert([row]);
  }

  /* ---------- turns ---------- */

  async appendTurn(input: AppendTurnInput): Promise<TurnRow> {
    const next = await this.nextTurnNumber(input.session_id);
    const now = new Date().toISOString();
    const row: TurnRow = {
      turn_id: randomUUID(),
      session_id: input.session_id,
      turn_number: next,
      role: input.role,
      tool_name: input.tool_name ?? null,
      tool_use_id: input.tool_use_id ?? null,
      approval_state: input.approval_state ?? null,
      content: input.content,
      created_at: now,
    };
    // BQ streaming insert: `content` needs to be a JSON string so it
    // lands in the JSON column.
    await this.bq
      .dataset(this.dataset, { projectId: this.project })
      .table('turns')
      .insert([
        {
          ...row,
          content: JSON.stringify(row.content ?? null),
        },
      ]);
    this.log.debug(
      {
        session_id: row.session_id,
        turn_number: row.turn_number,
        role: row.role,
        tool_name: row.tool_name,
      },
      'turn_appended',
    );
    return row;
  }

  async getTurns(sessionId: string): Promise<TurnRow[]> {
    const sql = `
      SELECT turn_id, session_id, turn_number, role,
             tool_name, tool_use_id, approval_state,
             TO_JSON_STRING(content) AS content_json,
             FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6SZ', created_at) AS created_at
      FROM \`${this.project}.${this.dataset}.turns\`
      WHERE session_id = @session_id
      ORDER BY turn_number ASC
    `;
    const [rows] = await this.bq.query({
      query: sql,
      params: { session_id: sessionId },
    });
    return (rows as Array<TurnRow & { content_json: string }>).map((r) => ({
      turn_id: r.turn_id,
      session_id: r.session_id,
      turn_number: r.turn_number,
      role: r.role,
      tool_name: r.tool_name,
      tool_use_id: r.tool_use_id,
      approval_state: r.approval_state,
      content: safeParse(r.content_json),
      created_at: r.created_at,
    }));
  }

  /**
   * Look up the latest approval row for a given tool_use_id in a
   * session. Used by the loop to decide whether a write tool can run.
   */
  async getLatestApproval(
    sessionId: string,
    toolUseId: string,
  ): Promise<TurnRow | null> {
    const sql = `
      SELECT turn_id, session_id, turn_number, role,
             tool_name, tool_use_id, approval_state,
             TO_JSON_STRING(content) AS content_json,
             FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6SZ', created_at) AS created_at
      FROM \`${this.project}.${this.dataset}.turns\`
      WHERE session_id = @session_id
        AND tool_use_id = @tool_use_id
        AND role = 'approval'
      ORDER BY turn_number DESC
      LIMIT 1
    `;
    const [rows] = await this.bq.query({
      query: sql,
      params: { session_id: sessionId, tool_use_id: toolUseId },
    });
    const r = rows[0] as (TurnRow & { content_json: string }) | undefined;
    if (!r) return null;
    return {
      turn_id: r.turn_id,
      session_id: r.session_id,
      turn_number: r.turn_number,
      role: r.role,
      tool_name: r.tool_name,
      tool_use_id: r.tool_use_id,
      approval_state: r.approval_state,
      content: safeParse(r.content_json),
      created_at: r.created_at,
    };
  }

  /**
   * List recent sessions for a given user, most-recently-active first.
   * Relies on the sessions table being clustered on user_email for efficiency.
   */
  async listSessionsForUser(
    userEmail: string,
    limit = 50,
  ): Promise<Array<{ sessionId: string; title: string | null; lastActivityAt: string; createdAt: string }>> {
    const sql = `
      SELECT
        session_id,
        ANY_VALUE(title) AS title,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', MAX(last_activity_at)) AS last_activity_at,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', MIN(created_at))       AS created_at
      FROM \`${this.project}.${this.dataset}.sessions\`
      WHERE user_email = @user_email
      GROUP BY session_id
      ORDER BY MAX(last_activity_at) DESC
      LIMIT @limit
    `;
    const [rows] = await this.bq.query({
      query: sql,
      params: { user_email: userEmail, limit },
      types: { user_email: 'STRING', limit: 'INT64' },
    });
    return (rows as Array<{
      session_id: string;
      title: string | null;
      last_activity_at: string;
      created_at: string;
    }>).map((r) => ({
      sessionId: r.session_id,
      title: r.title,
      lastActivityAt: r.last_activity_at,
      createdAt: r.created_at,
    }));
  }

  /* ---------- internals ---------- */

  private async nextTurnNumber(sessionId: string): Promise<number> {
    const sql = `
      SELECT IFNULL(MAX(turn_number), 0) + 1 AS n
      FROM \`${this.project}.${this.dataset}.turns\`
      WHERE session_id = @session_id
    `;
    const [rows] = await this.bq.query({
      query: sql,
      params: { session_id: sessionId },
    });
    const n = (rows[0] as { n?: number } | undefined)?.n ?? 1;
    return typeof n === 'number' ? n : Number(n);
  }
}

function safeParse(s: string | null | undefined): unknown {
  if (s == null) return null;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
