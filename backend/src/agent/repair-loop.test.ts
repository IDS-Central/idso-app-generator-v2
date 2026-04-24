/**
 * Unit tests for agent/repair-loop.ts helpers.
 *
 * Run: cd backend && npm run build && npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_REPAIR_ATTEMPTS,
  classifyBuildFailure,
  formatRepairPrompt,
  shouldAttemptRepair,
} from '../agent/repair-loop.js';

test('classifyBuildFailure extracts TypeScript compiler errors', () => {
  const logs = [
    'Step #1: Installing dependencies...',
    'Step #2: Compiling...',
    "src/foo.ts(12,3): error TS2345: Type 'string' is not assignable to type 'number'.",
    'Build failed with exit code 2',
  ].join('\n');
  const line = classifyBuildFailure(logs);
  assert.ok(line, 'expected a matched line');
  assert.match(line!, /error TS2345/);
});

test('classifyBuildFailure extracts Dockerfile parse errors', () => {
  const logs = [
    'Sending build context to Docker daemon',
    'Dockerfile parse error line 4: unknown instruction: FORM',
    'Error: failed to prepare context',
  ].join('\n');
  const line = classifyBuildFailure(logs);
  assert.ok(line);
  assert.match(line!, /Dockerfile parse error/i);
});

test('classifyBuildFailure returns last non-empty line when no pattern matches', () => {
  const logs = ['hello world', '', 'something happened', ''].join('\n');
  const line = classifyBuildFailure(logs);
  assert.equal(line, 'something happened');
});

test('classifyBuildFailure returns null on empty input', () => {
  assert.equal(classifyBuildFailure(''), null);
  assert.equal(classifyBuildFailure('\n\n\n'), null);
});

test('shouldAttemptRepair allows first and second retries', () => {
  assert.equal(shouldAttemptRepair({ attempt_num: 0 }).allowed, true);
  assert.equal(shouldAttemptRepair({ attempt_num: 1 }).allowed, true);
  assert.equal(shouldAttemptRepair({ attempt_num: 2 }).allowed, true);
});

test('shouldAttemptRepair refuses once budget is exhausted', () => {
  const decision = shouldAttemptRepair({ attempt_num: MAX_REPAIR_ATTEMPTS });
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /budget/);
});

test('formatRepairPrompt includes build_id, attempt numbers, and log tail', () => {
  const text = formatRepairPrompt({
    build_id: 'abc-123',
    log_tail: 'Step #3: FAILURE',
    attempt_num: 1,
    max_attempts: 3,
  });
  assert.match(text, /abc-123/);
  assert.match(text, /attempt 1 of 3/);
  assert.match(text, /Step #3: FAILURE/);
});
