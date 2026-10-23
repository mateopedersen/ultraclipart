import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSearchIndex } from '../src/lib/search-index.ts';
import { SearchRepository, SearchHttpError, mapLimit } from '../src/lib/search-remote.ts';
import { LatestRequest } from '../src/lib/search-request.ts';
import { defaults, searchArtwork } from '../src/lib/search.ts';
const original = JSON.parse(readFileSync(new URL('../data/art.json', import.meta.url)));
const topics = JSON.parse(readFileSync(new URL('../data/topics.json', import.meta.url))).topics;
const real = original.map((item) => ({
  ...item,
  cluster: topics.find((topic) => topic.slug === item.topic)?.cluster ?? '',
}));
const fixture = (data) => {
  const build = buildSearchIndex(data, topics, 'test-version'),
    requests = [];
  const loader = async (path, signal) => {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    requests.push(path);
    const key = path.replace(/^\/search-data\//, '').replace(/\.json$/, '');
    if (!build.files.has(key)) throw new SearchHttpError(404);
    return structuredClone(build.files.get(key));
  };
  return { build, requests, loader, repo: new SearchRepository(loader) };
};
const comparable = ({ items, total, pages, page, hasFuzzyMatches }) => ({
  ids: items.map((item) => item.id),
  total,
  pages,
  page,
  hasFuzzyMatches,
});
const synthetic = Array.from({ length: 5500 }, (_, index) => {
  const topic = topics[Math.floor(index / 50)],
    n = index % 50;
  return {
    ...original[index % original.length],
    id: `${topic.slug}-design-${n}`,
    topic: topic.slug,
    title: `${topic.keyword} ${String(n).padStart(2, '0')}`,
    description: `Original ${n % 2 ? 'ribbon leaf garden' : 'small cheerful seasonal'} design ${n}`,
    alt: `${topic.keyword} illustration ${n}`,
    cluster: topic.cluster,
    style: n % 3 === 0 ? 'Outline' : 'Color',
    color: ['Black', 'Orange', 'Green', 'Purple', 'Blue'][n % 5],
    orientation: ['Square', 'Portrait', 'Landscape'][n % 3],
    formats: n % 4 ? ['WEBP', 'PDF'] : ['WEBP'],
    alpha: n % 2 === 0,
    createdAt: `2026-${String(1 + (index % 12)).padStart(2, '0')}-${String(1 + (index % 28)).padStart(2, '0')}`,
  };
});
const queryCases = [
  '',
  'pumpkin',
  'pumkin',
  'pumpkins clipart',
  'present',
  'leaves',
  'black and white pumpkin',
  'b&w pumpkin',
  'coloring pages',
  'outline spider',
  'Halloween',
  'flower garden',
  'snowmen',
  'xmas',
  'cat',
  'unicorn',
  'NOT-A-REAL-SUBJECT',
  'leaf leaf',
];
test('sharded search exactly matches the existing scorer, typo handling and all facets on the real pilot', async () => {
  const { repo } = fixture(real);
  for (const q of queryCases)
    for (const sort of ['relevance', 'title', 'newest'])
      for (const patch of [
        {},
        { style: 'outline' },
        { color: 'orange', format: 'pdf' },
        { orientation: 'portrait' },
        { background: 'opaque' },
        { page: 999, size: 16 },
      ]) {
        const state = { ...defaults, q, sort, ...patch };
        assert.deepEqual(
          comparable(await repo.search(state)),
          comparable(searchArtwork(real, state)),
          JSON.stringify(state),
        );
      }
});
test('5,500-item search is equivalent across all 110 topic queries, filters, ranks and distant pages', async () => {
  const { repo } = fixture(synthetic);
  for (let i = 0; i < topics.length; i++) {
    const states = [
      { q: topics[i].keyword },
      { q: topics[i].keyword, style: 'outline', format: 'pdf', sort: 'newest' },
      { q: topics[i].keyword, color: 'green', orientation: 'landscape', background: 'transparent' },
      { q: topics[i].keyword, page: 3, size: 16, sort: 'title' },
    ];
    for (const patch of states) {
      const state = { ...defaults, ...patch };
      assert.deepEqual(
        comparable(await repo.search(state)),
        comparable(searchArtwork(synthetic, state)),
        JSON.stringify(state),
      );
    }
  }
  for (const patch of [
    { page: 688 },
    { page: 172, size: 32, sort: 'newest' },
    { q: 'seasonal', page: 20, sort: 'newest' },
    { q: 'pumkin', size: 32 },
    { style: 'outline', page: 80 },
    { background: 'opaque', format: 'webp', sort: 'newest' },
  ]) {
    const state = { ...defaults, ...patch };
    assert.deepEqual(
      comparable(await repo.search(state)),
      comparable(searchArtwork(synthetic, state)),
      JSON.stringify(state),
    );
  }
});
test('initial browse transfers only eight card records and one ranked ID page at target scale', async (t) => {
  const { repo, requests, build } = fixture(synthetic);
  const result = await repo.search(defaults);
  assert.equal(result.items.length, 8);
  assert.equal(requests.filter((path) => path.includes('/items/')).length, 8);
  assert.equal(requests.filter((path) => path.includes('/ranked/')).length, 1);
  assert.equal(
    requests.some((path) => /\/(tokens|lexicon|order|ids)\//.test(path)),
    false,
  );
  const bytes = requests.reduce(
    (total, path) =>
      total +
      Buffer.byteLength(
        JSON.stringify(build.files.get(path.replace('/search-data/', '').replace(/\.json$/, ''))),
      ),
    0,
  );
  assert.ok(bytes < 25000, `Initial search data is ${bytes} bytes`);
  const projectedPagesFiles = build.files.size + 5500 * 2 + 110 + 200;
  assert.ok(
    projectedPagesFiles < 20000,
    `Projected Pages deployment has ${projectedPagesFiles} files`,
  );
  assert.ok(build.files.size < 6500, `Static index file count ${build.files.size}`);
  t.diagnostic(
    JSON.stringify({
      catalogSize: 5500,
      initialJsonBytes: bytes,
      initialCardRecords: 8,
      indexFiles: build.files.size,
      projectedPagesFiles,
      freePlanFileCap: 20000,
    }),
  );
});
test('a broad query downloads postings but only the visible page metadata, and favorites request only saved IDs', async () => {
  const a = fixture(synthetic);
  await a.repo.search({ ...defaults, q: 'seasonal' });
  assert.equal(a.requests.filter((path) => path.includes('/items/')).length, 8);
  assert.ok(a.requests.some((path) => path.includes('/tokens/')));
  const b = fixture(synthetic);
  const ids = [synthetic[20].id, synthetic[4000].id];
  const result = await b.repo.favoriteItems(ids);
  assert.deepEqual(
    result.map((item) => item.id),
    ids,
  );
  assert.deepEqual(
    b.requests.filter((path) => !path.endsWith('/manifest.json')).sort(),
    ids.map((id) => `/search-data/test-version/items/${id}.json`).sort(),
  );
  assert.deepEqual(await b.repo.favoriteItems(['../bad', 'removed-artwork']), [null, null]);
});
test('the latest request wins even when the old response ignores cancellation, and stale errors stay silent', async () => {
  const gate = new LatestRequest(),
    events = [];
  let resolveOld, rejectOld;
  const old = gate.run(
    () => new Promise((resolve) => (resolveOld = resolve)),
    (value) => events.push(value),
    () => events.push('old-error'),
  );
  await gate.run(
    async () => 'new',
    (value) => events.push(value),
    () => events.push('new-error'),
  );
  resolveOld('old');
  await old;
  assert.deepEqual(events, ['new']);
  const rejected = gate.run(
    () => new Promise((_, reject) => (rejectOld = reject)),
    (value) => events.push(value),
    () => events.push('stale-error'),
  );
  await gate.run(
    async () => 'newest',
    (value) => events.push(value),
    () => {},
  );
  rejectOld(new Error('late failure'));
  await rejected;
  assert.deepEqual(events, ['new', 'newest']);
});
test('failed fetches can be retried, aborted responses do not enter cache, and network concurrency is bounded', async () => {
  const base = fixture(real);
  let failures = 1;
  const repo = new SearchRepository(async (...args) => {
    if (failures-- > 0) throw new Error('offline');
    return base.loader(...args);
  });
  await assert.rejects(repo.search(defaults), /offline/);
  assert.equal((await repo.search(defaults)).items.length, 8);
  let active = 0,
    peak = 0;
  await mapLimit(
    Array.from({ length: 24 }, (_, i) => i),
    async (value) => {
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return value;
    },
  );
  assert.equal(peak, 8);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(repo.search(defaults, controller.signal), { name: 'AbortError' });
  let release;
  let calls = 0;
  const gated = new SearchRepository(async (...args) => {
    calls++;
    if (calls === 1) await new Promise((resolve) => (release = resolve));
    return base.loader(args[0]);
  });
  const midFlight = new AbortController();
  const aborted = gated.search(defaults, midFlight.signal);
  midFlight.abort();
  release();
  await assert.rejects(aborted, { name: 'AbortError' });
  const callsBefore = calls;
  await gated.search(defaults);
  assert.ok(calls > callsBefore + 1, 'aborted manifest must be fetched again');
});
