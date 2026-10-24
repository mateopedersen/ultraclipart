import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shardRasterTargets } from '../scripts/ci-raster-shards.mjs';

test('unsharded browser invocation retains its original exact target list', () => {
  const targets = [{ id: 'one' }, { id: 'two' }];
  assert.equal(shardRasterTargets(targets, {}), targets);
});
test('all seasonal catalog targets occur exactly once across the three CI shards', () => {
  const topics = new Set(
    'winter,halloween,pumpkin,ghost,witch,skeleton,vampire,bat,spider,thanksgiving,turkey'.split(
      ',',
    ),
  );
  const targets = JSON.parse(
    readFileSync(new URL('../data/art.json', import.meta.url), 'utf8'),
  ).filter((item) => item.sourceType === 'raster' && topics.has(item.topic));
  assert.equal(targets.length, 550, 'Keep all currently published seasonal artworks covered');
  const shards = [0, 1, 2].map((index) =>
    shardRasterTargets(targets, { RASTER_SHARD_COUNT: '3', RASTER_SHARD_INDEX: String(index) }),
  );
  assert.deepEqual(
    shards.map((part) => part.length),
    [184, 183, 183],
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
  assert.ok(
    workflow.includes(
      'RASTER_TOPICS=winter,halloween,pumpkin,ghost,witch,skeleton,vampire,bat,spider,thanksgiving,turkey ALL_RASTER=1',
    ),
  );
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
