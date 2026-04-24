/**
 * Repair loop orchestration helper (Phase 2 plan item #8).
 *
 * This module provides pure logic that the main tool-use loop in
 * agent/loop.ts can import to implement the retry/repair loop on
 * `cloud_build_wait` FAILURE. It deliberately does NOT modify loop.ts
 * directly  integration into the live dispatcher is a Phase 2 follow-up
 * flagged as "best effort, needs review" in CHECKPOINT.md.
 *
 * Design (per docs/PHASE-PLAN.md item #8):
 *   On `cloud_build_wait` returning FAILURE, the loop:
 *     1. Automatically calls `read_build_logs` with the build_id.
 *     2. Appends the log tail (last ~4KB) to the conversation as a
 *        synthetic user-turn with a system-note prefix.
 *     3. Lets Claude propose a fix, commit it, and resubmit via
 *        `cloudrun_deploy` (which re-fires the trigger).
 *     4. Counts this as one repair attempt; bounded to 3 per build.
 *
 * The helper exposes:
 *   - classifyBuildFailure(logs): extract the most likely root-cause line
 *   - formatRepairPrompt(build_id, log_tail, attempt_num): produce a
 *     synthetic user message to append to the conversation
 *   - shouldAttemptRepair(state): gate function returning {allowed, reason}
 */

export interface BuildFailureContext {
  build_id: string;
  log_tail: string;
  attempt_num: number;
  max_attempts: number;
}

export interface RepairDecision {
  allowed: boolean;
  reason: string;
}

export const MAX_REPAIR_ATTEMPTS = 3;

/**
 * Extract the most likely root-cause line from a build log tail.
 * Heuristics: prefer lines matching "error:", "Error:", "FAILED", "fatal",
 * Dockerfile parse errors, TypeScript compiler errors. Returns the full
 * matching line (trimmed) or null if nothing useful was found.
 */
export function classifyBuildFailure(logTail: string): string | null {
  const lines = logTail.split('\n');
  const patterns: RegExp[] = [
    /\berror\s+TS\d+:/i, // tsc error
    /\bSyntaxError\b/,
    /\bReferenceError\b/,
    /\bCannot find module\b/,
    /\bERR_MODULE_NOT_FOUND\b/,
    /Dockerfile parse error/i,
    /unable to prepare context/i,
    /(FAILED|FATAL|FAIL):/i,
    /^error:/i,
    /\bfailed to push\b/i,
  ];
  for (const re of patterns) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const ln = lines[i]?.trim();
      if (ln && re.test(ln)) return ln.slice(0, 500);
    }
  }
  // Last resort: last non-empty line
  for (let i = lines.length - 1; i >= 0; i--) {
    const ln = lines[i]?.trim();
    if (ln) return ln.slice(0, 500);
  }
  return null;
}

/**
 * Compose the synthetic user message that gets appended to the
 * conversation so Claude can analyse the failure and propose a fix.
 */
export function formatRepairPrompt(ctx: BuildFailureContext): string {
  const likely = classifyBuildFailure(ctx.log_tail);
  const headline = likely ? `Likely root cause:\n\`\`\`\n${likely}\n\`\`\`\n\n` : '';
  return [
    `[system: automatic repair attempt ${ctx.attempt_num} of ${ctx.max_attempts}]`,
    '',
    `The last Cloud Build (\`${ctx.build_id}\`) failed.`,
    '',
    headline,
    'Log tail (most recent last):',
    '```',
    ctx.log_tail.slice(-3800),
    '```',
    '',
    'Diagnose the root cause from the logs above, propose a minimal fix,',
    'apply it via `write_owner_file` / GitHub contents edits, and rerun',
    'the deploy with `cloudrun_deploy`. If you cannot identify a fix,',
    'stop and return an explanation to the user instead of looping.',
  ].join('\n');
}

/**
 * Decide whether another repair attempt should be allowed.
 * The orchestrator MUST honour {allowed:false}  Cloud Build failures can
 * cascade quickly and the loop must bound spend + cycle count.
 */
export function shouldAttemptRepair(state: { attempt_num: number }): RepairDecision {
  if (state.attempt_num >= MAX_REPAIR_ATTEMPTS) {
    return { allowed: false, reason: `repair budget exhausted (${MAX_REPAIR_ATTEMPTS} attempts)` };
  }
  return { allowed: true, reason: '' };
}
