import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypescript } from './helpers/typescript.mjs';
const { latestSubjectCollections } = await loadTypescript('src/lib/collection-discovery.ts');
const subjects = [
  {
    slug: 'new-animal',
    name: 'New Animal',
    count: 2,
    sample: { thumb: '/a.webp', alt: 'Animal', title: 'Animal' },
  },
  {
    slug: 'flower',
    name: 'Flower',
    count: 1,
    sample: { thumb: '/b.webp', alt: 'Flower', title: 'Flower' },
  },
];
test('new subjects appear automatically with their existing canonical collection route', () => {
  const items = latestSubjectCollections(subjects, [
    { id: 'new', topic: 'new-animal', published: true, indexable: true },
    { id: 'older', topic: 'flower', published: true, indexable: true },
  ]);
  assert.equal(items[0].href, '/clipart/new-animal/');
  assert.equal(items[0].count, 2);
  assert.equal(items[1].href, '/clipart/flower/');
});
test('an addition to an existing subject updates one collection rather than making duplicates', () =>
  assert.equal(
    latestSubjectCollections(subjects, [
      { id: 'a', topic: 'flower' },
      { id: 'b', topic: 'flower' },
    ]).length,
    1,
  ));
test('draft and unknown content cannot generate empty collection cards', () =>
  assert.deepEqual(
    latestSubjectCollections(subjects, [
      { id: 'draft', topic: 'flower', published: false },
      { id: 'unknown', topic: 'missing' },
    ]),
    [],
  ));
