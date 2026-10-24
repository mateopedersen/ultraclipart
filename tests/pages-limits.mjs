import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPagesFileCount, PAGES_FILE_LIMIT } from '../src/lib/pages-limits.ts';

test('Pro allows growth past the old Free ceiling and rejects overflow', () => {
  assert.equal(PAGES_FILE_LIMIT, 100_000);
  for (const count of [0, 20_001, 99_999, 100_000])
    assert.doesNotThrow(() => assertPagesFileCount(count));
  assert.throws(() => assertPagesFileCount(100_001), /Pages Pro file limit exceeded/);
});

test('an invalid count cannot bypass the file ceiling', () => {
  for (const count of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => assertPagesFileCount(count), /safe integer/);
});
