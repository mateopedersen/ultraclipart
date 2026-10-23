import test from 'node:test';
import assert from 'node:assert/strict';
import { SearchRepository, SearchHttpError } from '../src/lib/search-remote.ts';

const manifest = (version) => ({
  schema: 1,
  version,
  total: 2,
  pageChunk: 32,
  tokenBuckets: 256,
  lexiconLengths: [],
  facets: [],
  topics: [],
});
const card = (id, version) => ({
  id,
  title: `${id} ${version}`,
  alt: id,
  thumb: `/${version}/${id}.webp`,
  webp: `/${version}/${id}.webp`,
});

test('favorites recover once from a replaced deployment without reporting an existing ID as removed', async () => {
  let version = 'old';
  const requests = [];
  const repository = new SearchRepository(async (path) => {
    requests.push(path);
    if (path.endsWith('/manifest.json')) return manifest(version);
    if (!path.startsWith(`/search-data/${version}/`)) throw new SearchHttpError(404);
    return card(path.split('/').pop().replace('.json', ''), version);
  });
  await repository.favoriteItems(['pumpkin']);
  version = 'new';
  const result = await repository.favoriteItems(['pumpkin', 'ghost']);
  assert.deepEqual(
    result.map((item) => item?.title),
    ['pumpkin new', 'ghost new'],
  );
  assert.equal(requests.filter((path) => path.endsWith('/manifest.json')).length, 2);
  assert.equal(requests.filter((path) => path === '/search-data/old/items/ghost.json').length, 1);
});

test('a missing ID in the current generation returns null after one manifest check without a retry loop', async () => {
  const requests = [];
  const repository = new SearchRepository(async (path) => {
    requests.push(path);
    if (path.endsWith('/manifest.json')) return manifest('current');
    throw new SearchHttpError(404);
  });
  assert.deepEqual(await repository.favoriteItems(['removed']), [null]);
  assert.equal(requests.filter((path) => path.endsWith('/manifest.json')).length, 2);
  assert.equal(requests.filter((path) => path.includes('/items/')).length, 1);
});

test('a genuinely removed favorite stays missing after one changed-generation retry', async () => {
  let manifestReads = 0;
  let itemReads = 0;
  const repository = new SearchRepository(async (path) => {
    if (path.endsWith('/manifest.json')) return manifest(++manifestReads === 1 ? 'old' : 'new');
    itemReads++;
    throw new SearchHttpError(404);
  });
  assert.deepEqual(await repository.favoriteItems(['removed']), [null]);
  assert.equal(manifestReads, 2);
  assert.equal(itemReads, 2);
});

test('aborting the manifest refresh rejects without caching it or fetching a new-generation item', async () => {
  let release;
  let manifestReads = 0;
  const requests = [];
  const repository = new SearchRepository(async (path) => {
    requests.push(path);
    if (path.endsWith('/manifest.json')) {
      manifestReads++;
      if (manifestReads === 1) return manifest('old');
      if (manifestReads === 2)
        return new Promise((resolve) => {
          release = () => resolve(manifest('new'));
        });
      return manifest('new');
    }
    if (path.startsWith('/search-data/old/')) throw new SearchHttpError(404);
    return card('ghost', 'new');
  });
  const controller = new AbortController();
  const pending = repository.favoriteItems(['ghost'], controller.signal);
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  release();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(requests.filter((path) => path.startsWith('/search-data/new/items/')).length, 0);
  assert.deepEqual(
    (await repository.favoriteItems(['ghost'])).map((item) => item?.title),
    ['ghost new'],
  );
  assert.equal(manifestReads, 3, 'the aborted fresh manifest must not enter cache');
});
