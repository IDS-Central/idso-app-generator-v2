/**
 * Dispatcher: tool name -> handler.
 *
 * Write tools land progressively in Commit 2b. As of this revision:
 *   - iam_create_sa      -> wired (see ./iam.ts)
 *   - gh_create_repo           -> wired (see ./github.ts)
 *   - cloudbuild_create_trigger -> not yet implemented
 *   - cloudrun_deploy    -> not yet implemented
 * The loop gate pauses on write tools for user approval before dispatch,
 * so any unwired tool invocation returns a clear 'not_implemented'
 * response rather than crashing the turn.
 */

import type { ToolHandler, ToolHandlerDeps, ToolResult } from './types.js';
import { err } from './types.js';
import { getTool, isWriteTool } from './schema.js';
import { bqCatalogSearch, bqDescribeTable, bqDryRun } from './bq.js';
import { askUser } from './ask.js';
import { iamCreateSa } from './iam.js';
import { ghCreateRepo } from './github.js';

const HANDLERS: Record<string, ToolHandler<any, any>> = {
  bq_catalog_search: bqCatalogSearch,
  bq_describe_table: bqDescribeTable,
  bq_dry_run: bqDryRun,
  ask_user: askUser,
  iam_create_sa: iamCreateSa,
  gh_create_repo: ghCreateRepo,
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
