/**
 * Plan / budget tools.
 *
 * plan_present: surface a structured build plan to the user for approval.
 *   The plan is a declarative document (app_name, repo, sql_instance,
 *   secrets list, Cloud Run service, required roles, estimated monthly
 *   cost, etc.). The dispatcher treats this as a read tool: it just
 *   renders the plan to the user; actual approval/rejection is handled
 *   separately via the /approve route and the `plan_approved` event in
 *   the builds table. This tool's job is to standardise the plan shape.
 *
 * budget_check: given an app_name, returns the current month-to-date
 *   billable usage tally (best-effort, pulled from our own builds table
 *   rather than Cloud Billing API  the Billing API requires elevated
 *   IAM the runtime SA does not have). Returns ok even when the tally
 *   is zero. This is a lightweight signal the loop can use to avoid
 *   runaway spend  hard stops live in the dispatcher.
 */
import type { ToolHandler, ToolHandlerDeps } from './types.js';
import { ok, err } from './types.js';

const APP_NAME_RE = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/;

interface PlanStep { tool: string; summary: string; side_effect: 'read' | 'write' }

interface PlanPresentInput {
  app_name?: string;
  summary?: string;
  steps?: PlanStep[];
  estimated_monthly_cost_usd?: number;
  required_confirmations?: string[];
}

interface PlanPresentOutput {
  plan_id: string;
  app_name: string;
  step_count: number;
  write_step_count: number;
  estimated_monthly_cost_usd: number;
  rendered: string;
}

function renderPlan(p: PlanPresentInput & { plan_id: string }): string {
  const lines: string[] = [];
  lines.push(`# Build plan for ${p.app_name}`);
  lines.push('');
  if (p.summary) { lines.push(p.summary); lines.push(''); }
  lines.push('## Steps');
  (p.steps ?? []).forEach((s, i) => {
    const marker = s.side_effect === 'write' ? '' : '';
    lines.push(`${i + 1}. ${marker} \`${s.tool}\`  ${s.summary}`);
  });
  lines.push('');
  lines.push(`**Estimated monthly cost:** $${(p.estimated_monthly_cost_usd ?? 0).toFixed(2)}`);
  const req = p.required_confirmations ?? [];
  if (req.length > 0) {
    lines.push('');
    lines.push('**Required confirmations:**');
    for (const c of req) lines.push(`- ${c}`);
  }
  lines.push('');
  lines.push(`_plan_id: \`${p.plan_id}\`_`);
  return lines.join('\n');
}

export const planPresent: ToolHandler<PlanPresentInput, PlanPresentOutput> = async (
  input,
  deps: ToolHandlerDeps,
) => {
  const i = input as PlanPresentInput;
  const appName = String(i?.app_name ?? '').trim();
  if (!APP_NAME_RE.test(appName)) return err(`invalid app_name "${appName}"`, 'invalid_input');
  const steps = Array.isArray(i?.steps) ? i.steps : [];
  if (steps.length === 0) return err('plan must contain at least one step', 'invalid_input');
  for (const s of steps) {
    if (typeof s?.tool !== 'string' || typeof s?.summary !== 'string' || (s?.side_effect !== 'read' && s?.side_effect !== 'write')) {
      return err('each step must have tool:string, summary:string, side_effect: "read"|"write"', 'invalid_input');
    }
  }
  const cost = Number(i?.estimated_monthly_cost_usd ?? 0);
  if (!Number.isFinite(cost) || cost < 0 || cost > 1_000_000) {
    return err('estimated_monthly_cost_usd must be a non-negative number', 'invalid_input');
  }
  const log = deps.logger.child({ tool: 'plan_present', app_name: appName });
  const planId = `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const rendered = renderPlan({ ...i, plan_id: planId, app_name: appName, steps });
  const writeSteps = steps.filter((s) => s.side_effect === 'write').length;
  log.info({ event: 'plan_presented', plan_id: planId, step_count: steps.length, write_step_count: writeSteps, cost }, 'plan presented');
  return ok({
    plan_id: planId,
    app_name: appName,
    step_count: steps.length,
    write_step_count: writeSteps,
    estimated_monthly_cost_usd: cost,
    rendered,
  });
};

/* -------------------- budget_check -------------------- */
interface BudgetCheckInput { app_name?: string; month?: string }
interface BudgetCheckOutput {
  app_name: string;
  month: string;
  build_count: number;
  note: string;
}

export const budgetCheck: ToolHandler<BudgetCheckInput, BudgetCheckOutput> = async (
  input,
  deps: ToolHandlerDeps,
) => {
  const i = input as BudgetCheckInput;
  const appName = String(i?.app_name ?? '').trim();
  if (!APP_NAME_RE.test(appName)) return err(`invalid app_name "${appName}"`, 'invalid_input');
  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const month = String(i?.month ?? defaultMonth);
  if (!/^\d{4}-\d{2}$/.test(month)) return err(`invalid month "${month}" (expected YYYY-MM)`, 'invalid_input');
  const log = deps.logger.child({ tool: 'budget_check', app_name: appName, month });
  // Best-effort tally via our own builds table. Falls back to 0 on any error.
  let buildCount = 0;
  let note = 'tally computed from builds table (no direct Cloud Billing access)';
  try {
    const sql = `
      SELECT COUNT(1) AS c
      FROM \`reconciliation-dashboard.idso_app_generator.builds\`
      WHERE app_name = @app AND FORMAT_TIMESTAMP('%Y-%m', startedAt) = @month
    `;
    const [rows] = await deps.bq.query({
      query: sql,
      params: { app: appName, month },
      useLegacySql: false,
    });
    const first = rows[0] as { c?: number | string } | undefined;
    const n = Number(first?.c ?? 0);
    if (Number.isFinite(n)) buildCount = n;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    note = `tally unavailable: ${msg.slice(0, 200)}`;
    log.warn({ event: 'budget_tally_failed', err: msg }, 'budget tally failed; returning 0');
  }
  log.info({ event: 'budget_checked', build_count: buildCount }, 'budget checked');
  return ok({ app_name: appName, month, build_count: buildCount, note });
};
