import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { originalRasterTargets, shardRasterTargets } from '../scripts/ci-raster-shards.mjs';

test('unsharded browser invocation retains its original exact target list', () => {
  const targets = [{ id: 'one' }, { id: 'two' }];
  assert.equal(shardRasterTargets(targets, {}), targets);
});
test('all seasonal catalog targets occur exactly once across the three CI shards', () => {
  const topics = JSON.parse(
    readFileSync(new URL('../data/topics.json', import.meta.url), 'utf8'),
  ).topics;
  const catalog = JSON.parse(readFileSync(new URL('../data/art.json', import.meta.url), 'utf8'));
  const targets = originalRasterTargets(catalog, topics);
  assert.deepEqual(
    targets,
    catalog.filter(
      (item) =>
        item.sourceType === 'raster' &&
        item.productionMethod !== 'owner-supplied' &&
        topics.some((topic) => topic.slug === item.topic),
    ),
  );
  assert.ok(targets.length >= 550, 'Keep all currently published seasonal artworks covered');
  const shards = [0, 1, 2].map((index) =>
    shardRasterTargets(targets, { RASTER_SHARD_COUNT: '3', RASTER_SHARD_INDEX: String(index) }),
  );
  assert.deepEqual(
    shards.map((part) => part.length),
    [0, 1, 2].map((index) => Math.floor(targets.length / 3) + (index < targets.length % 3 ? 1 : 0)),
  );
  const originalIds = targets.map((item) => item.id).sort();
  const actualIds = shards
    .flat()
    .map((item) => item.id)
    .sort();
  assert.deepEqual(actualIds, originalIds);
  assert.equal(new Set(actualIds).size, targets.length);
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  for (const index of [0, 1, 2])
    assert.ok(workflow.includes(`catalog-seasonal-${index}`), `Shard ${index} must be dispatched`);
  assert.ok(workflow.includes('export RASTER_SHARD_COUNT=3'));
  assert.ok(workflow.includes('RASTER_ORIGINAL_TOPICS=1 ALL_RASTER=1'));
});
test('new planned topics enter editor coverage while owner packs and supplemental topics stay separate', () => {
  const catalog = [
    { id: 'new', topic: 'new-topic', sourceType: 'raster', productionMethod: 'generated-raster' },
    { id: 'owner', topic: 'new-topic', sourceType: 'raster', productionMethod: 'owner-supplied' },
    {
      id: 'extra',
      topic: 'extra-topic',
      sourceType: 'raster',
      productionMethod: 'generated-raster',
    },
    {
      id: 'vector',
      topic: 'new-topic',
      sourceType: 'vector',
      productionMethod: 'generated-vector',
    },
  ];
  assert.deepEqual(
    originalRasterTargets(catalog, [{ slug: 'new-topic' }]).map((art) => art.id),
    ['new'],
  );
  for (const topics of [[], [{ slug: 'same' }, { slug: 'same' }], [{ slug: '../escape' }], null])
    assert.throws(() => originalRasterTargets(catalog, topics));
});
test('both representative shards retain every subject and every near-limit PDF exactly once', () => {
  const art = JSON.parse(readFileSync(new URL('../data/art.json', import.meta.url), 'utf8')).filter(
    (item) => item.sourceType === 'raster',
  );
  const candidates = [
    ...[...new Set(art.map((item) => item.topic))].map((topic) =>
      art.find((item) => item.topic === topic),
    ),
    ...art.filter((item) => item.files.pdf.bytes > 995000),
    [...art].sort((a, b) => b.files.pdf.bytes - a.files.pdf.bytes)[0],
  ].filter(Boolean);
  const targets = [...new Map(candidates.map((item) => [item.id, item])).values()];
  const shards = [0, 1].map((index) =>
    shardRasterTargets(targets, {
      RASTER_SHARD_COUNT: '2',
      RASTER_SHARD_INDEX: String(index),
    }),
  );
  assert.deepEqual(
    shards
      .flat()
      .map((item) => item.id)
      .sort(),
    targets.map((item) => item.id).sort(),
  );
  assert.equal(new Set(shards.flat().map((item) => item.id)).size, targets.length);
  assert.ok(Math.abs(shards[0].length - shards[1].length) <= 1);
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  for (const suite of ['catalog-extra-3', 'catalog-extra-4']) assert.ok(workflow.includes(suite));
  for (const index of [0, 1]) assert.ok(workflow.includes(`export RASTER_SHARD_INDEX=${index}`));
  assert.ok(workflow.includes('export RASTER_SHARD_COUNT=2'));
  assert.equal(workflow.split('RASTER_PER_TOPIC=1').length - 1, 1);
});
test('partitioning remains complete and balanced for non-divisible target counts', () => {
  for (const size of [3, 4, 50, 551, 1000]) {
    const targets = Array.from({ length: size }, (_, id) => ({ id }));
    const shards = [0, 1, 2].map((index) =>
      shardRasterTargets(targets, { RASTER_SHARD_COUNT: '3', RASTER_SHARD_INDEX: String(index) }),
    );
    assert.deepEqual(
      shards
        .flat()
        .map((item) => item.id)
        .sort((a, b) => a - b),
      targets.map((item) => item.id),
    );
    assert.ok(
      Math.max(...shards.map((s) => s.length)) - Math.min(...shards.map((s) => s.length)) <= 1,
    );
  }
});
test('missing, invalid, excessive or empty shards fail rather than silently skip work', () => {
  for (const env of [
    { RASTER_SHARD_COUNT: '3' },
    { RASTER_SHARD_INDEX: '0' },
    { RASTER_SHARD_COUNT: '0', RASTER_SHARD_INDEX: '0' },
    { RASTER_SHARD_COUNT: '3', RASTER_SHARD_INDEX: '3' },
    { RASTER_SHARD_COUNT: '3', RASTER_SHARD_INDEX: '-1' },
    { RASTER_SHARD_COUNT: '1.5', RASTER_SHARD_INDEX: '0' },
    { RASTER_SHARD_COUNT: '65', RASTER_SHARD_INDEX: '0' },
    { RASTER_SHARD_COUNT: '3', RASTER_SHARD_INDEX: '1' },
  ])
    assert.throws(() => shardRasterTargets([{ id: 'one' }], env));
});
