import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTypescript } from './helpers/typescript.mjs';
const { primaryClusterForTopic, clustersForTopic } = await loadTypescript(
  'src/lib/topic-clusters.ts',
);
const topics = [
  ...JSON.parse(readFileSync('data/topics.json')).topics,
  ...JSON.parse(readFileSync('data/extra-topics.json')),
];
for (const [slug, expected] of [
  ['bat', 'Animals & nature'],
  ['spider', 'Animals & nature'],
  ['penguin', 'Animals & nature'],
  ['pumpkin', 'Food & drink'],
  ['sunflower', 'Nature & elements'],
  ['hat', 'Clothing & accessories'],
  ['football', 'Sports'],
  ['electric-car', 'Transport & vehicles'],
  ['earth', 'Space & science'],
  ['ghost', 'Halloween'],
])
  test(`Primary category describes the subject: ${slug}`, () =>
    assert.equal(primaryClusterForTopic(topics.find((t) => t.slug === slug)), expected));
test('A seasonal association remains separate from the primary subject category', () => {
  const bat = topics.find((t) => t.slug === 'bat');
  assert.ok(clustersForTopic(bat).includes('Halloween'));
  assert.equal(primaryClusterForTopic(bat), 'Animals & nature');
});
test('New topics use an explicitly registered browse category without guessing from a holiday phrase', () => {
  assert.equal(
    primaryClusterForTopic({
      slug: 'future-animal',
      cluster: 'Halloween',
      browseCluster: 'Animals & nature',
    }),
    'Animals & nature',
  );
});
