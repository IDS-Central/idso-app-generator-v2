/**
 * ask_user tool.
 *
 * The loop itself pauses on ask_user by inspecting the tool name; the
 * handler just returns the question and waits to be closed by the user's
 * reply. The reply becomes the tool_result content on the next turn.
 */

import type { ToolHandler } from './types.js';
import { ok } from './types.js';

type AskInput = { question: string };
type AskResult = { pending: true; question: string };

export const askUser: ToolHandler<AskInput, AskResult> = async (input, deps) => {
  deps.logger.info(
    { tool: 'ask_user', question: input.question },
    'ask_user_issued',
  );
  return ok({ pending: true, question: input.question });
};
