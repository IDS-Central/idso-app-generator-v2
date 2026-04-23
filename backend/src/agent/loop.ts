/**
 * Anthropic tool-use loop with approval gating.
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
 *
 * The loop is read-only on its own state  caller passes in sessionId and the
 * loop reconstitutes message history from session_turns each invocation.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { Logger } from 'pino';
import type { SessionStore, TurnRow } from '../session/store.js';
import { dispatch } from '../tools/registry.js';
import type { ToolHandlerDeps } from '../tools/types.js';
import { isWriteTool, toAnthropicTools, type AnthropicToolDef } from '../tools/schema.js';

const DEFAULT_MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS = 4096;
const MAX_ITERATIONS = 12; // hard ceiling so we never spin forever

// Anthropic message content block shapes we care about.
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

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
  | { status: 'awaiting_approval'; toolUseId: string; toolName: string; toolInput: unknown; iterations: number }
  | { status: 'error'; error: string; iterations: number };

/**
 * Reconstruct the Anthropic messages[] array from persisted turn rows.
 * Strategy: walk turns in order, group consecutive assistant tool_call rows
 * with their following tool_result rows into a single assistant+user pair.
 */
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
      const text = typeof t.content === 'string' ? t.content : JSON.stringify(t.content);
      messages.push({ role: 'user', content: text });
    } else if (t.role === 'assistant') {
      flushPending();
      const text = typeof t.content === 'string' ? t.content : JSON.stringify(t.content);
      messages.push({ role: 'assistant', content: text });
    } else if (t.role === 'tool_call') {
      const c = t.content as { id: string; name: string; input: unknown; assistant_text?: string };
      if (!pendingAssistant) pendingAssistant = [];
      if (c.assistant_text && pendingAssistant.length === 0) {
        pendingAssistant.push({ type: 'text', text: c.assistant_text });
      }
      pendingAssistant.push({ type: 'tool_use', id: c.id, name: c.name, input: c.input });
    } else if (t.role === 'tool_result') {
      const c = t.content as { tool_use_id: string; output: unknown; is_error?: boolean };
      if (!pendingToolResults) pendingToolResults = [];
      pendingToolResults.push({
        type: 'tool_result',
        tool_use_id: c.tool_use_id,
        content: typeof c.output === 'string' ? c.output : JSON.stringify(c.output),
        is_error: c.is_error ?? false,
      });
    }
    // 'approval' rows are control-plane only and not replayed to the model
  }
  flushPending();
  return messages;
}

/**
 * Run the loop until completion, approval-needed, or hard error.
 * Caller is responsible for having appended the latest user turn before calling.
 */
export async function runAgentLoop(deps: LoopDeps, sessionId: string): Promise<LoopResult> {
  const log = deps.logger.child({ component: 'agent_loop', session_id: sessionId });
  const tools: AnthropicToolDef[] = toAnthropicTools();
  const model = deps.model ?? DEFAULT_MODEL;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations += 1;

    // Re-hydrate full message history from BQ each turn.
    let turns = await deps.store.getTurns(sessionId);

    // Resume bug fix: before calling Anthropic, dispatch any tool_call turn
    // that has no matching tool_result yet. This handles the approval-resume
    // case (/approve persisted an 'approved' approval row, but the tool
    // hasn't actually run yet, so the assistant tool_use block has no
    // tool_result to pair with and Anthropic would reject the messages[]).
    const resultedToolUseIds = new Set(
      turns
        .filter((t) => t.role === 'tool_result' && t.tool_use_id)
        .map((t) => t.tool_use_id as string),
    );
    const pendingToolCalls = turns.filter(
      (t) => t.role === 'tool_call' && t.tool_use_id && !resultedToolUseIds.has(t.tool_use_id),
    );
    for (const pc of pendingToolCalls) {
      const c = pc.content as { id: string; name: string; input: unknown };
      const toolName = pc.tool_name ?? c.name;
      const toolUseId = pc.tool_use_id as string;
      if (isWriteTool(toolName)) {
        const approvalRow = await deps.store.getLatestApproval(sessionId, toolUseId);
        const approvalState = approvalRow?.approval_state ?? null;
        if (approvalState !== 'approved') {
          log.info(
            { iter: iterations, tool: toolName, tool_use_id: toolUseId, approval_state: approvalState ?? 'none' },
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
        { iter: iterations, tool: toolName, tool_use_id: toolUseId, ok: result.ok },
        'agent_loop_resume_tool_dispatched',
      );
    }
    if (pendingToolCalls.length > 0) {
      // Re-hydrate so messages[] includes the fresh tool_result turns.
      turns = await deps.store.getTurns(sessionId);
    }

    const messages = turnsToMessages(turns);

    if (messages.length === 0) {
      return { status: 'error', error: 'no_user_message', iterations };
    }

    log.info({ iter: iterations, msg_count: messages.length, resumed_tools: pendingToolCalls.length }, 'agent_loop_iter_begin');

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
      const err = e instanceof Error ? e.message : String(e);
      log.error({ err }, 'anthropic_messages_create_failed');
      return { status: 'error', error: err, iterations };
    }

    const stopReason = response.stop_reason;
    const blocks = response.content as ContentBlock[];

    // Extract assistant text (if any) for persistence + final answer.
    const textBlocks = blocks.filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text');
    const assistantText = textBlocks.map((b) => b.text).join('\n').trim();

    // If the model produced any text but no tool_use, persist plain assistant turn.
    const toolUseBlocks = blocks.filter((b): b is Extract<ContentBlock, { type: 'tool_use' }> => b.type === 'tool_use');

    if (toolUseBlocks.length === 0) {
      // Final answer  persist and return.
      if (assistantText.length > 0) {
        await deps.store.appendTurn({
          session_id: sessionId,
          role: 'assistant',
          content: assistantText,
        });
      }
      log.info({ iter: iterations, stop: stopReason, text_len: assistantText.length }, 'agent_loop_completed');
      return { status: 'completed', finalText: assistantText, iterations };
    }

    // Persist every tool_use block as its own tool_call turn so we can replay later.
    // First call also carries the assistant_text preface (if any) so it shows up in history.
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

    // Process each tool_use in order. For writes, require approval.
    for (const tu of toolUseBlocks) {
      const isWrite = isWriteTool(tu.name);
      if (isWrite) {
        const approvalRow = await deps.store.getLatestApproval(sessionId, tu.id);
        const approvalState = approvalRow?.approval_state ?? null;
        if (approvalState !== 'approved') {
          log.info(
            { iter: iterations, tool: tu.name, tool_use_id: tu.id, approval_state: approvalState ?? 'none' },
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

      // Dispatch the tool (read tool, or pre-approved write tool).
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
    }

    // Loop continues  model will see the new tool_result turns on next hydrate.
    if (stopReason !== 'tool_use') {
      log.warn({ iter: iterations, stop: stopReason }, 'agent_loop_unexpected_stop_with_tool_use');
    }
  }

  log.warn({ iter: iterations }, 'agent_loop_max_iterations_exceeded');
  return { status: 'error', error: 'max_iterations_exceeded', iterations };
}
