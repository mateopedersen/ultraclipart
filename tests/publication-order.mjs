import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTypescript } from './helpers/typescript.mjs';
const { newestFirst, publicationTime } = await loadTypescript('src/lib/publication-order.ts');

test('newest ordering compares actual instants across timezone offsets', () => {
  const source = [
    { id: 'older', createdAt: '2026-10-26T12:00:00+03:00' },
    { id: 'newer', createdAt: '2026-10-26T10:00:00Z' },
  ];
  assert.deepEqual(
    newestFirst(source).map((i) => i.id),
    ['newer', 'older'],
  );
  assert.equal(source[0].id, 'older');
});
test('later catalog additions lead when timestamps are equal', () => {
  const source = ['first', 'second', 'last'].map((id) => ({
    id,
    createdAt: '2026-10-26T10:00:00Z',
  }));
  assert.deepEqual(
    newestFirst(source).map((i) => i.id),
    ['last', 'second', 'first'],
  );
});
test('first publication time stays authoritative over a later edit timestamp', () => {
  assert.equal(
    publicationTime({
      firstPublishedAt: '2026-10-20T00:00:00Z',
      createdAt: '2026-10-26T00:00:00Z',
    }),
    Date.parse('2026-10-20T00:00:00Z'),
  );
  assert.equal(
    publicationTime({ publishedAt: '2026-10-26T00:00:00Z', createdAt: '2026-10-20T00:00:00Z' }),
    Date.parse('2026-10-26T00:00:00Z'),
  );
});
test('invalid dates do not produce unstable NaN comparisons', () => {
  assert.equal(
    publicationTime({ publishedAt: 'invalid', createdAt: '2026-10-26' }),
    Date.parse('2026-10-26'),
  );
  assert.equal(publicationTime({}), 0);
});
