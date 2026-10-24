import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSearchIndex } from '../src/lib/search-index.ts';
import { SearchRepository, SearchHttpError, mapLimit } from '../src/lib/search-remote.ts';
import { LatestRequest } from '../src/lib/search-request.ts';
import { defaults, searchArtwork } from '../src/lib/search.ts';
const original = JSON.parse(readFileSync(new URL('../data/art.json', import.meta.url)));
const topics = JSON.parse(readFileSync(new URL('../data/topics.json', import.meta.url))).topics;
const extraTopics = JSON.parse(readFileSync(new URL('../data/extra-topics.json', import.meta.url)));
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
  assert.equal(requests.filter((path) => path.includes('/items/')).length, 1);
  assert.equal(requests.filter((path) => path.includes('/locations/')).length, 0);
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
test('current catalog search shards fit the Pages file budget with room for the book collection', () => {
  const allTopics = [...topics, ...extraTopics];
  const cluster = new Map(allTopics.map((topic) => [topic.slug, topic.cluster]));
  const build = buildSearchIndex(
    original.map((item) => ({ ...item, cluster: cluster.get(item.topic) ?? '' })),
    allTopics,
    'budget-test',
  );
  const projected = build.files.size + original.length * 2 + allTopics.length + 200;
  assert.ok(projected < 20000, `Projected Pages deployment has ${projected} files`);
  assert.ok(projected <= 19600, `Leave capacity for routine site assets: ${projected}`);
});
test('queries resolve bounded card chunks and favorites locate only their saved IDs', async () => {
  const a = fixture(synthetic);
  const page = await a.repo.search({ ...defaults, q: 'seasonal' });
  assert.equal(page.items.length, 8);
  assert.ok(a.requests.filter((path) => path.includes('/items/')).length <= 8);
  assert.equal(a.requests.filter((path) => path.includes('/locations/')).length, 0);
  assert.ok(a.requests.some((path) => path.includes('/tokens/')));
  const b = fixture(synthetic);
  const ids = [synthetic[20].id, synthetic[4000].id];
  const result = await b.repo.favoriteItems(ids);
  assert.deepEqual(
    result.map((item) => item.id),
    ids,
  );
  assert.equal(b.requests.filter((path) => path.includes('/locations/')).length, 2);
  assert.equal(b.requests.filter((path) => path.includes('/items/')).length, 2);
  assert.equal(
    b.requests.some((path) => /\/(tokens|ranked|order|ids)\//.test(path)),
    false,
  );
  assert.deepEqual(await b.repo.favoriteItems(['../bad', 'removed-artwork']), [null, null]);
});

test('card chunks preserve exact ID bindings and same-search requests share one fetch', async () => {
  const f = fixture(synthetic);
  const manifest = await f.repo.manifest();
  const first = f.build.files.get('test-version/items/0');
  const cards = await Promise.all(first.map((item) => f.repo.item(item.id, manifest)));
  assert.deepEqual(
    cards.map((item) => item.id),
    first.map((item) => item.id),
  );
  assert.equal(f.requests.filter((path) => path.includes('/items/')).length, 1);
  const broken = fixture(synthetic);
  broken.build.files.get('test-version/items/0').reverse();
  await assert.rejects(broken.repo.search(defaults), /could not be read/);
});

test('all 40 technology collections retain Free-plan file headroom at 7,700 artworks', () => {
  const allTopics = [...topics, ...extraTopics];
  const future = Array.from({ length: 7700 }, (_, n) => ({
    ...real[n % real.length],
    id: `capacity-artwork-${n}`,
  }));
  const build = buildSearchIndex(future, allTopics, 'capacity');
  const projected = build.files.size + future.length * 2 + allTopics.length + 200;
  assert.ok(projected < 19600, `Technology capacity exceeds safe file budget: ${projected}`);
});

test('cancelling an older chunk request cannot cancel or poison a newer search', async () => {
  const f = fixture(synthetic);
  const gates = [];
  const repo = new SearchRepository(async (path, signal) => {
    if (path.includes('/items/')) await new Promise((resolve) => gates.push(resolve));
    return f.loader(path, signal);
  });
  const manifest = await repo.manifest();
  const id = f.build.files.get('test-version/items/0')[0].id;
  const old = new AbortController();
  const current = new AbortController();
  const before = repo.item(id, manifest, old.signal, 0);
  const after = repo.item(id, manifest, current.signal, 0);
  assert.equal(gates.length, 2, 'different cancellation scopes must not share a fetch');
  old.abort();
  gates.forEach((resolve) => resolve());
  await assert.rejects(before, { name: 'AbortError' });
  assert.equal((await after).id, id);
  assert.equal((await repo.item(id, manifest)).id, id);
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
