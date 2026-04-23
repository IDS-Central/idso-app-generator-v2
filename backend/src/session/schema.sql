-- idso_app_generator session store schema.
--
-- Run once per environment via the bootstrap module. Idempotent: uses
-- CREATE SCHEMA IF NOT EXISTS and CREATE TABLE IF NOT EXISTS so boot
-- can call this every time without harm.
--
-- Everything lives inside reconciliation-dashboard.idso_app_generator
-- so it's quarantined from the warehouse datasets.

CREATE SCHEMA IF NOT EXISTS `reconciliation-dashboard.idso_app_generator`
OPTIONS(
  description = "State for the IDSO app generator: chat sessions, turns, approvals. Private to the generator backend service account."
);

-- One row per user-facing conversation with the generator.
CREATE TABLE IF NOT EXISTS `reconciliation-dashboard.idso_app_generator.sessions` (
  session_id       STRING      NOT NULL,
  user_email       STRING      NOT NULL,
  title            STRING,
  state            STRING      NOT NULL,  -- active | completed | abandoned
  created_at       TIMESTAMP   NOT NULL,
  last_activity_at TIMESTAMP   NOT NULL
)
PARTITION BY DATE(created_at)
CLUSTER BY user_email, session_id
OPTIONS(
  description = "One row per generator chat session."
);

-- Append-only log of every turn in every session. Single source of truth
-- for replaying a session: feed these rows back into the loop in order.
CREATE TABLE IF NOT EXISTS `reconciliation-dashboard.idso_app_generator.turns` (
  turn_id         STRING     NOT NULL,
  session_id      STRING     NOT NULL,
  turn_number     INT64      NOT NULL,
  role            STRING     NOT NULL,  -- user | assistant | tool_call | tool_result | approval
  tool_name       STRING,               -- populated when role IN ('tool_call','tool_result','approval')
  tool_use_id     STRING,               -- Anthropic tool_use id, links call<->result<->approval
  approval_state  STRING,               -- pending | approved | rejected  (only for role='approval')
  content         JSON       NOT NULL,  -- role-specific payload; see SessionStore in store.ts
  created_at      TIMESTAMP  NOT NULL
)
PARTITION BY DATE(created_at)
CLUSTER BY session_id, turn_number
OPTIONS(
  description = "Append-only log of turns within generator sessions."
);
