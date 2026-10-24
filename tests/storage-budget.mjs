import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceStorageBudget, HARD_CAP } from '../scripts/r2/plan.mjs';

test('free-tier account budget refuses an over-budget wave without relaxing the global cap', () => {
  const limit = 9_500_000_000;
  const exact = { measuredBytes: 8_000_000_000, projectedBytes: limit };
  assert.equal(enforceStorageBudget(exact, limit), exact);
  assert.throws(() => enforceStorageBudget({ projectedBytes: limit + 1 }, limit), /storage budget/);
  for (const invalid of [0, -1, Infinity, 9.5, HARD_CAP + 1])
    assert.throws(() => enforceStorageBudget({ projectedBytes: 1 }, invalid), /Invalid/);
});
