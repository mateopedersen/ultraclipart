import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const base = process.env.BASE_URL ?? 'https://ultraclipart.com';
const expected = process.env.EXPECTED_REVISION;
assert(/^[a-f0-9]{40}$/.test(expected ?? ''), 'Specify the deployed revision');
const report = JSON.parse(fs.readFileSync('data/tesla-commerce-collection-review.json'));
const items = report.items,
  publication = JSON.parse(fs.readFileSync('data/publication.json'));
const asset = new Map(publication.files.map((x) => [x.assetId + ':' + x.kind, x]));
const collections = JSON.parse(
  fs.readFileSync('data/editorial/tesla-commerce-collections.json'),
).topics;
const get = async (p) => {
  const r = await fetch(new URL(p, base), {
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(r.status, 200, p);
  return r;
};
const revision = (html, p) =>
  assert(html.includes(`name="build-revision" content="${expected}"`), 'Wrong revision: ' + p);
const home = await (await get('/')).text();
revision(home, '/');
const stats = await (await get('/catalog-stats.json')).json();
assert(stats.totals.artworks >= report.baselineCount + 550);
const pages = await (await get('/sitemap-pages.xml')).text(),
  images = await (await get('/sitemap-images.xml')).text();
let routes = 0,
  downloads = 0;
for (const [topic, record] of Object.entries(collections)) {
  const p = `/clipart/${topic}/`,
    html = await (await get(p)).text();
  revision(html, p);
  assert.equal(stats.topics[topic], items.filter((x) => x.topic === topic).length);
  assert(
    html.includes(record.intro.replaceAll('&', '&amp;')),
    'Missing reviewed introduction: ' + topic,
  );
  assert(pages.includes(p));
  assert(!html.includes('content="noindex'));
  routes++;
}
if (base === 'https://ultraclipart.com')
  for (const [from, to] of [
    ['tesla-cybercab', 'cybercab'],
    ['optimus-robot', 'tesla-optimus'],
  ]) {
    for (const suffix of ['', '/']) {
      const r = await fetch(`${base}/clipart/${from}${suffix}`, { redirect: 'manual' });
      assert.equal(r.status, 301);
      assert.equal(new URL(r.headers.get('location'), base).pathname, `/clipart/${to}/`);
    }
  }
let cursor = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++],
        p = `/art/${item.id}/`,
        html = await (await get(p)).text();
      revision(html, p);
      const schemas = [
        ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
      ].map((m) => JSON.parse(m[1]));
      const schema = schemas.find((x) => x['@type'] === 'ImageObject');
      assert.equal(schema.name, item.title);
      assert.equal(schema.description, item.description);
      assert.equal(schema.contentUrl, asset.get(item.id + ':webp').url);
      assert(html.includes(`https://ultraclipart.com${p}`));
      assert(!html.includes('content="noindex'));
      assert.doesNotMatch(
        html,
        /The scene is an imagined illustration\.|REAL GENERATED EXAMPLES|FLUX\.1 SCHNELL/i,
      );
      assert(pages.includes(p) && images.includes(p), 'Missing sitemap entry: ' + item.id);
      const editor = await (await get(`/edit/${item.id}/`)).text();
      revision(editor, '/edit/' + item.id);
      assert(editor.includes('noindex,follow'));
      routes += 2;
    }
  }),
);
for (const topic of Object.keys(collections)) {
  const item = items.find((x) => x.topic === topic);
  for (const kind of ['webp', 'pdf']) {
    const record = asset.get(item.id + ':' + kind),
      r = await fetch(record.url);
    assert.equal(r.status, 200);
    assert.equal(
      r.headers.get('content-type')?.split(';')[0],
      kind === 'pdf' ? 'application/pdf' : 'image/webp',
    );
    const body = Buffer.from(await r.arrayBuffer());
    assert.equal(body.length, record.bytes);
    assert.equal(createHash('sha256').update(body).digest('hex'), record.sha256);
    downloads++;
  }
}
const result = {
  status: 'PASS',
  scope:
    base === 'https://ultraclipart.com'
      ? 'ACTUAL_PRODUCTION_HTTP_AND_MEDIA'
      : 'LOCAL_PREVIEW_HTTP_AND_MEDIA',
  revision: expected,
  base,
  artworks: items.length,
  routeChecks: routes,
  mediaChecks: downloads,
  topics: Object.keys(collections).length,
  stats: stats.totals,
  at: new Date().toISOString(),
  browserInteraction: 'separate actual browser evidence required',
};
fs.writeFileSync(
  'work/imports/tesla-commerce-550/live-http-report.json',
  JSON.stringify(result, null, 2) + '\n',
);
console.log(result);
