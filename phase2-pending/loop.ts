/**
 * Anthropic tool-use loop with approval gating + auto-repair on build failure.
 *
 * Responsibilities:
 *   1. Call client.messages.create with the typed tool registry advertised.
 *   2. For every tool_use block returned by the model:
 *        - read tools (side_effect: 'read'): dispatch immediately
 *        - write tools (side_effect: 'write'): require an 'approved' approval
 *          row in session_turns for that tool_use_id; otherwise emit
 *          {status:'awaiting_approval', toolUseId} and pause the loop
 *   3. Persist every step (user, assistant, tool_call, tool_result, approval)
 *      via SessionStore.appendTurn so the conversation is fully reconstructable.
 *   4. Loop until either:
 *        - the model returns stop_reason !== 'tool_use' (final answer), OR
 *        - a write tool needs approval (caller resumes by re-invoking after
 *          the user approves out-of-band).
 *   5. Auto-repair hook: after dispatching `cloud_build_wait`, if the result
 *      indicates a build failure and the repair-attempt budget is not yet
 *      exhausted, auto-dispatch `read_build_logs` and inject a synthetic
 *      user turn with the repair prompt from repair-loop.ts. The next
 *      loop iteration will let Claude propose + apply a fix.
 *
 * The loop is read-only on its own state — caller passes in sessionId and the
 * loop reconstitutes message history from session_turns each invocation.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { Logger } from 'pino';
import type { SessionStore, TurnRow } from '../session/store.js';
import { dispatch } from '../tools/registry.js';
import type { ToolHandlerDeps } from '../tools/types.js';
import {
  isWriteTool,
  toAnthropicTools,
  type AnthropicToolDef,
} from '../tools/schema.js';
import {
  MAX_REPAIR_ATTEMPTS,
  formatRepairPrompt,
  shouldAttemptRepair,
} from './repair-loop.js';

const DEFAULT_MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS = 4096;
const MAX_ITERATIONS = 12;
const REPAIR_MARKER = '[system: automatic repair attempt';
const BUILD_FAILURE_STATES = new Set([
  'FAILURE',
  'INTERNAL_ERROR',
  'TIMEOUT',
  'CANCELLED',
  'EXPIRED',
]);

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | {
      type: 'tool_result';
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
};

export type LoopDeps = {
  anthropic: Anthropic;
  logger: Logger;
  store: SessionStore;
  toolDeps: ToolHandlerDeps;
  systemPrompt: string;
  model?: string;
};

export type LoopResult =
  | { status: 'completed'; finalText: string; iterations: number }
  | {
      status: 'awaiting_approval';
      toolUseId: string;
      toolName: string;
      toolInput: unknown;
      iterations: number;
    }
  | { status: 'error'; error: string; iterations: number };

function turnsToMessages(turns: TurnRow[]): AnthropicMessage[] {
  const messages: AnthropicMessage[] = [];
  let pendingAssistant: ContentBlock[] | null = null;
  let pendingToolResults: ContentBlock[] | null = null;
  const flushPending = () => {
    if (pendingAssistant && pendingAssistant.length > 0) {
      messages.push({ role: 'assistant', content: pendingAssistant });
      pendingAssistant = null;
    }
    if (pendingToolResults && pendingToolResults.length > 0) {
      messages.push({ role: 'user', content: pendingToolResults });
      pendingToolResults = null;
    }
  };
  for (const t of turns) {
    if (t.role === 'user') {
      flushPending();
      const text =
        typeof t.content === 'string' ? t.content : JSON.stringify(t.content);
      messages.push({ role: 'user', content: text });
    } else if (t.role === 'assistant') {
      flushPending();
      const text =
        typeof t.content === 'string' ? t.content : JSON.stringify(t.content);
      messages.push({ role: 'assistant', content: text });
    } else if (t.role === 'tool_call') {
      const c = t.content as {
        id: string;
        name: string;
        input: unknown;
        assistant_text?: string;
      };
      if (!pendingAssistant) pendingAssistant = [];
      if (c.assistant_text && pendingAssistant.length === 0) {
        pendingAssistant.push({ type: 'text', text: c.assistant_text });
      }
      pendingAssistant.push({
        type: 'tool_use',
        id: c.id,
        name: c.name,
        input: c.input,
      });
    } else if (t.role === 'tool_result') {
      const c = t.content as {
        tool_use_id: string;
        output: unknown;
        is_error?: boolean;
      };
      if (!pendingToolResults) pendingToolResults = [];
      pendingToolResults.push({
        type: 'tool_result',
        tool_use_id: c.tool_use_id,
        content:
          typeof c.output === 'string' ? c.output : JSON.stringify(c.output),
        is_error: c.is_error ?? false,
      });
    }
  }
  flushPending();
  return messages;
}

/**
 * Scan persisted turns for prior repair-prompt user turns (identified by
 * REPAIR_MARKER prefix) that target the same build_id. Used to bound the
 * repair-attempt budget across loop invocations.
 */
function countRepairAttempts(turns: TurnRow[], buildId: string): number {
  let count = 0;
  for (const t of turns) {
    if (t.role === 'user' && typeof t.content === 'string') {
      if (
        t.content.startsWith(REPAIR_MARKER) &&
        t.content.includes(`\`${buildId}\``)
      ) {
        count += 1;
      }
    }
  }
  return count;
}

/**
 * If a cloud_build_wait tool_result indicates a build failure, auto-fetch
 * the build logs and append a synthetic user turn with the repair prompt.
 * Returns true iff a repair prompt was appended (caller should re-hydrate).
 */
async function maybeTriggerRepair(args: {
  toolName: string;
  toolResult: { ok: boolean; data?: unknown; error?: string };
  deps: LoopDeps;
  sessionId: string;
  log: Logger;
}): Promise<boolean> {
  if (args.toolName !== 'cloud_build_wait') return false;
  if (!args.toolResult.ok) return false;
  const data = args.toolResult.data as
    | { status?: string; build_id?: string }
    | undefined;
  const state = (data?.status ?? '').toUpperCase();
  const buildId = data?.build_id ?? '';
  if (!buildId) return false;
  if (!BUILD_FAILURE_STATES.has(state)) return false;

  // Count prior repair attempts for this build_id.
  const turns = await args.deps.store.getTurns(args.sessionId);
  const priorAttempts = countRepairAttempts(turns, buildId);
  const decision = shouldAttemptRepair({ attempt_num: priorAttempts });
  if (!decision.allowed) {
    args.log.warn(
      { build_id: buildId, prior_attempts: priorAttempts, reason: decision.reason },
      'agent_loop_repair_budget_exhausted',
    );
    return false;
  }

  // Fetch build logs via read_build_logs (best-effort; repair prompt still
  // goes through even if log fetch fails, with an empty tail).
  let logTail = '';
  try {
    const logsResult = await dispatch(
      'read_build_logs',
      { build_id: buildId },
      args.deps.toolDeps,
    );
    if (logsResult.ok) {
      const rd = logsResult.data as { log_text?: string; entries?: unknown[] };
      logTail = (rd.log_text ?? '').slice(-4000);
      if (!logTail && Array.isArray(rd.entries)) {
        logTail = rd.entries
          .map((e) => (typeof e === 'string' ? e : JSON.stringify(e)))
          .join('\n')
          .slice(-4000);
      }
    } else {
      args.log.warn(
        { build_id: buildId, err: logsResult.error },
        'agent_loop_repair_log_fetch_failed',
      );
    }
  } catch (e) {
    args.log.warn(
      { build_id: buildId, err: e instanceof Error ? e.message : String(e) },
      'agent_loop_repair_log_fetch_threw',
    );
  }

  const prompt = formatRepairPrompt({
    build_id: buildId,
    log_tail: logTail,
    attempt_num: priorAttempts + 1,
    max_attempts: MAX_REPAIR_ATTEMPTS,
  });
  await args.deps.store.appendTurn({
    session_id: args.sessionId,
    role: 'user',
    content: prompt,
  });
  args.log.info(
    {
      build_id: buildId,
      attempt_num: priorAttempts + 1,
      max_attempts: MAX_REPAIR_ATTEMPTS,
      log_tail_bytes: logTail.length,
    },
    'agent_loop_repair_prompt_injected',
  );
  return true;
}

export async function runAgentLoop(
  deps: LoopDeps,
  sessionId: string,
): Promise<LoopResult> {
  const log = deps.logger.child({
    component: 'agent_loop',
    session_id: sessionId,
  });
  const tools: AnthropicToolDef[] = toAnthropicTools();
  const model = deps.model ?? DEFAULT_MODEL;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations += 1;
    let turns = await deps.store.getTurns(sessionId);

    const resultedToolUseIds = new Set(
      turns
        .filter((t) => t.role === 'tool_result' && t.tool_use_id)
        .map((t) => t.tool_use_id as string),
    );
    const pendingToolCalls = turns.filter(
      (t) =>
        t.role === 'tool_call' &&
        t.tool_use_id &&
        !resultedToolUseIds.has(t.tool_use_id),
    );

    for (const pc of pendingToolCalls) {
      const c = pc.content as { id: string; name: string; input: unknown };
      const toolName = pc.tool_name ?? c.name;
      const toolUseId = pc.tool_use_id as string;

      if (isWriteTool(toolName)) {
        const approvalRow = await deps.store.getLatestApproval(
          sessionId,
          toolUseId,
        );
        const approvalState = approvalRow?.approval_state ?? null;
        if (approvalState !== 'approved') {
          log.info(
            {
              iter: iterations,
              tool: toolName,
              tool_use_id: toolUseId,
              approval_state: approvalState ?? 'none',
            },
            'agent_loop_awaiting_approval_resume',
          );
          return {
            status: 'awaiting_approval',
            toolUseId,
            toolName,
            toolInput: c.input,
            iterations,
          };
        }
      }

      const result = await dispatch(toolName, c.input, deps.toolDeps);
      await deps.store.appendTurn({
        session_id: sessionId,
        role: 'tool_result',
        content: {
          tool_use_id: toolUseId,
          output: result,
          is_error: !result.ok,
        },
        tool_name: toolName,
        tool_use_id: toolUseId,
      });
      log.info(
        {
          iter: iterations,
          tool: toolName,
          tool_use_id: toolUseId,
          ok: result.ok,
        },
        'agent_loop_resume_tool_dispatched',
      );

      // Auto-repair hook for pending resume path too.
      await maybeTriggerRepair({
        toolName,
        toolResult: result,
        deps,
        sessionId,
        log,
      });
    }

    if (pendingToolCalls.length > 0) {
      turns = await deps.store.getTurns(sessionId);
    }

    const messages = turnsToMessages(turns);
    if (messages.length === 0) {
      return { status: 'error', error: 'no_user_message', iterations };
    }

    log.info(
      {
        iter: iterations,
        msg_count: messages.length,
        resumed_tools: pendingToolCalls.length,
      },
      'agent_loop_iter_begin',
    );

    let response;
    try {
      response = await deps.anthropic.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system: deps.systemPrompt,
        tools: tools as unknown as Anthropic.Tool[],
        messages: messages as unknown as Anthropic.MessageParam[],
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      log.error({ err: errMsg }, 'anthropic_messages_create_failed');
      return { status: 'error', error: errMsg, iterations };
    }

    const stopReason = response.stop_reason;
    const blocks = response.content as ContentBlock[];

    const textBlocks = blocks.filter(
      (b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text',
    );
    const assistantText = textBlocks
      .map((b) => b.text)
      .join('\n')
      .trim();

    const toolUseBlocks = blocks.filter(
      (b): b is Extract<ContentBlock, { type: 'tool_use' }> =>
        b.type === 'tool_use',
    );
    if (toolUseBlocks.length === 0) {
      if (assistantText.length > 0) {
        await deps.store.appendTurn({
          session_id: sessionId,
          role: 'assistant',
          content: assistantText,
        });
      }
      log.info(
        { iter: iterations, stop: stopReason, text_len: assistantText.length },
        'agent_loop_completed',
      );
      return { status: 'completed', finalText: assistantText, iterations };
    }

    let textAttached = false;
    for (const tu of toolUseBlocks) {
      await deps.store.appendTurn({
        session_id: sessionId,
        role: 'tool_call',
        content: {
          id: tu.id,
          name: tu.name,
          input: tu.input,
          ...(textAttached ? {} : { assistant_text: assistantText }),
        },
        tool_name: tu.name,
        tool_use_id: tu.id,
      });
      textAttached = true;
    }

    for (const tu of toolUseBlocks) {
      const isWrite = isWriteTool(tu.name);
      if (isWrite) {
        const approvalRow = await deps.store.getLatestApproval(
          sessionId,
          tu.id,
        );
        const approvalState = approvalRow?.approval_state ?? null;
        if (approvalState !== 'approved') {
          log.info(
            {
              iter: iterations,
              tool: tu.name,
              tool_use_id: tu.id,
              approval_state: approvalState ?? 'none',
            },
            'agent_loop_awaiting_approval',
          );
          return {
            status: 'awaiting_approval',
            toolUseId: tu.id,
            toolName: tu.name,
            toolInput: tu.input,
            iterations,
          };
        }
      }

      const result = await dispatch(tu.name, tu.input, deps.toolDeps);
      await deps.store.appendTurn({
        session_id: sessionId,
        role: 'tool_result',
        content: {
          tool_use_id: tu.id,
          output: result,
          is_error: !result.ok,
        },
        tool_name: tu.name,
        tool_use_id: tu.id,
      });
      log.info(
        { iter: iterations, tool: tu.name, tool_use_id: tu.id, ok: result.ok },
        'agent_loop_tool_dispatched',
      );

      // Auto-repair hook on main-path dispatch.
      await maybeTriggerRepair({
        toolName: tu.name,
        toolResult: result,
        deps,
        sessionId,
        log,
      });
    }

    if (stopReason !== 'tool_use') {
      log.warn(
        { iter: iterations, stop: stopReason },
        'agent_loop_unexpected_stop_with_tool_use',
      );
    }
  }

  log.warn({ iter: iterations }, 'agent_loop_max_iterations_exceeded');
  return { status: 'error', error: 'max_iterations_exceeded', iterations };
}