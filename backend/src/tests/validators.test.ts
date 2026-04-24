/**
 * Unit tests for tool validators and small pure helpers.
 *
 * Uses Node's built-in test runner (node:test) so we don't need a new
 * dependency. Run with: node --import tsx --test dist/src/tests/validators.test.js
 * (or `tsc && node --test dist/...` once emit is wired).
 *
 * Phase 2 plan item #10.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyBuildFailure,
  formatRepairPrompt,
  shouldAttemptRepair,
  MAX_REPAIR_ATTEMPTS,
} from '../agent/repair-loop.js';
import { TOOL_REGISTRY, getTool, isWriteTool } from '../tools/schema.js';

/* -------------------- repair-loop pure helpers -------------------- */

test('classifyBuildFailure finds tsc error', () => {
  const tail = [
    'Building container image...',
    'src/foo.ts(10,5): error TS2304: Cannot find name "xyz".',
    'Step #1 FAILED',
  ].join('\n');
  const out = classifyBuildFailure(tail);
  assert.ok(out?.includes('TS2304'), 'should surface the TS2304 line');
});

test('classifyBuildFailure finds ESM module-not-found', () => {
  const tail = [
    'Starting container...',
    "Error [ERR_MODULE_NOT_FOUND]: Cannot find module './types'",
    'Exit code 1',
  ].join('\n');
  const out = classifyBuildFailure(tail);
  assert.ok(out?.includes('ERR_MODULE_NOT_FOUND'), 'should surface ESM error');
});

test('classifyBuildFailure returns last non-empty line when no pattern matches', () => {
  const tail = 'some benign output\nmore benign\nend of log';
  const out = classifyBuildFailure(tail);
  assert.equal(out, 'end of log');
});

test('classifyBuildFailure returns null on empty input', () => {
  assert.equal(classifyBuildFailure(''), null);
});

test('formatRepairPrompt includes build_id and attempt counter', () => {
  const p = formatRepairPrompt({
    build_id: 'deadbeef-1234',
    log_tail: 'fatal error: nope',
    attempt_num: 2,
    max_attempts: 3,
  });
  assert.ok(p.includes('deadbeef-1234'));
  assert.ok(p.includes('attempt 2 of 3'));
});

test('shouldAttemptRepair respects the cap', () => {
  assert.deepEqual(shouldAttemptRepair({ attempt_num: 0 }), { allowed: true, reason: '' });
  assert.deepEqual(shouldAttemptRepair({ attempt_num: MAX_REPAIR_ATTEMPTS - 1 }), { allowed: true, reason: '' });
  assert.equal(shouldAttemptRepair({ attempt_num: MAX_REPAIR_ATTEMPTS }).allowed, false);
  assert.equal(shouldAttemptRepair({ attempt_num: MAX_REPAIR_ATTEMPTS + 5 }).allowed, false);
});

/* -------------------- tool registry shape -------------------- */

test('TOOL_REGISTRY contains all expected Phase 2 tools', () => {
  const names = TOOL_REGISTRY.map((t) => t.name);
  const required = [
    'ask_user',
    'bq_catalog_search', 'bq_describe_table', 'bq_dry_run',
    'iam_create_sa', 'gh_create_repo',
    'cloudbuild_create_trigger', 'cloudrun_deploy',
    'secret_create', 'secret_add_version', 'secret_access',
    'list_user_apps', 'write_owner_file',
    'read_build_logs', 'read_cloud_run_logs',
    'plan_present', 'budget_check',
    'oauth_add_redirect_uri',
    'run_in_build_sandbox',
    'sql_create_instance', 'sql_create_database', 'sql_create_user',
    'cloud_run_curl_protected', 'cloud_run_curl_health',
  ];
  for (const n of required) assert.ok(names.includes(n), `missing tool: ${n}`);
});

test('every tool has name + description + input_schema + side_effect', () => {
  for (const t of TOOL_REGISTRY) {
    assert.equal(typeof t.name, 'string', `${t.name}: name`);
    assert.ok(t.name.length > 0, `${t.name}: non-empty name`);
    assert.equal(typeof t.description, 'string', `${t.name}: description`);
    assert.ok(t.description.length > 10, `${t.name}: meaningful description`);
    assert.equal(t.input_schema.type, 'object', `${t.name}: object schema`);
    assert.equal(t.input_schema.additionalProperties, false, `${t.name}: closed schema`);
    assert.ok(['read', 'write'].includes(t.side_effect), `${t.name}: side_effect`);
  }
});

test('getTool / isWriteTool round-trip', () => {
  assert.equal(getTool('iam_create_sa')?.side_effect, 'write');
  assert.equal(getTool('bq_catalog_search')?.side_effect, 'read');
  assert.equal(getTool('nonexistent_tool'), undefined);
  assert.equal(isWriteTool('iam_create_sa'), true);
  assert.equal(isWriteTool('bq_catalog_search'), false);
  assert.equal(isWriteTool('nope'), false);
});

test('no duplicate tool names', () => {
  const seen = new Set<string>();
  for (const t of TOOL_REGISTRY) {
    assert.ok(!seen.has(t.name), `duplicate tool name: ${t.name}`);
    seen.add(t.name);
  }
});

test('write tools have a required field', () => {
  for (const t of TOOL_REGISTRY) {
    if (t.side_effect !== 'write') continue;
    assert.ok(
      t.input_schema.required && t.input_schema.required.length > 0,
      `write tool "${t.name}" must require at least one field`,
    );
  }
});
