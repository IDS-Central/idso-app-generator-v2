/**
 * Dispatcher: tool name -> handler.
 *
 * Write tools (iam_create_sa, gh_create_repo, cloudbuild_create_trigger,
 * cloudrun_deploy) are intentionally NOT wired here yet. The loop gate
 * pauses on write tools for user approval; attempting to invoke one
 * before the write handlers land in a follow-up commit will return a
 * clear 'not_implemented' error instead of crashing.
 */

import type { ToolHandler, ToolHandlerDeps, ToolResult } from './types.js';
import { err } from './types.js';
import { getTool, isWriteTool } from './schema.js';
import { bqCatalogSearch, bqDescribeTable, bqDryRun } from './bq.js';
import { askUser } from './ask.js';

const HANDLERS: Record<string, ToolHandler<any, any>> = {
  bq_catalog_search: bqCatalogSearch,
  bq_describe_table: bqDescribeTable,
  bq_dry_run: bqDryRun,
  ask_user: askUser,
};

export async function dispatch(
  name: string,
  input: unknown,
  deps: ToolHandlerDeps,
): Promise<ToolResult> {
  const spec = getTool(name);
  if (!spec) {
    return err(`unknown tool: ${name}`, 'unknown_tool');
  }
  const handler = HANDLERS[name];
  if (!handler) {
    const why = isWriteTool(name)
      ? `write tool "${name}" is not yet implemented; waiting for Phase 2 commit 2b`
      : `read tool "${name}" has no handler registered`;
    return err(why, 'not_implemented');
  }
  try {
    return await handler(input as never, deps);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    deps.logger.error({ tool: name, error: msg }, 'tool_handler_threw');
    return err(msg, 'handler_exception');
  }
}

export function knownTools(): string[] {
  return Object.keys(HANDLERS);
}
