import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateIdentification } from '../scripts/identification-review.mjs';
import { resolveArtworkCopy } from '../scripts/artwork-editorial.mjs';
import { packageContexts, packageMetadata } from '../scripts/gta-six-copy.mjs';
import { defaults, searchArtwork } from '../src/lib/search.ts';
const read = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const art = read('data/art.json'),
  rows = art.filter((x) => x.sourceCollection === 'owner-gta-six-2026-10-26');
const identities = read('data/identification/gta-six.json').artworks;
const editorialReviews = new Map(
  read('data/editorial/reviews.json').artworks.map((row) => [row.id, row]),
);
test('six supplied GTA archives produce 300 reviewed, source-bound image/PDF pairs in five public subjects', () => {
  assert.equal(rows.length, 300);
  assert.equal(identities.length, 300);
  assert.equal(
    read('data/gta-six-review.json').identityReview.registrySha256,
    createHash('sha256')
      .update(readFileSync(new URL('../data/identification/gta-six.json', import.meta.url)))
      .digest('hex'),
  );
  assert.equal(new Set(rows.map((x) => x.id)).size, 300);
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(packageContexts).map((t) => [t, rows.filter((x) => x.topic === t).length]),
    ),
    { 'gta-6': 100, 'gta-6-jason': 50, 'gta-6-lucia': 50, 'gta-6-map': 50, 'grand-theft-auto': 50 },
  );
  assert.ok(!rows.some((x) => x.topic === 'gta-vi'));
  assert.equal(new Set(rows.map((x) => x.title)).size, 300);
  assert.equal(new Set(rows.map((x) => x.alt)).size, 300);
  for (const item of rows) {
    const record = identities.find((x) => x.id === item.id);
    const bytes = readFileSync(new URL('../public' + item.webp, import.meta.url));
    validateIdentification({ artwork: item, sourceBytes: bytes, record });
    const changed = Buffer.from(bytes);
    changed[0] ^= 1;
    assert.throws(
      () => validateIdentification({ artwork: item, sourceBytes: changed, record }),
      /source changed/,
    );
    for (const key of ['title', 'alt', 'description', 'style', 'visualStyle'])
      assert.equal(item[key], packageMetadata(item.topic, item.id, item.files.webp.sha256)[key]);
    for (const kind of ['pdf', 'webp', 'thumb']) {
      const body = readFileSync(new URL('../public' + item[kind], import.meta.url));
      assert.equal(body.length, item.files[kind].bytes);
      assert.equal(createHash('sha256').update(body).digest('hex'), item.files[kind].sha256);
    }
    if (record.catalogColor) assert.equal(item.color, record.catalogColor);
    assert.equal(item.discovery.cute, false);
    assert.equal(item.width, 1254);
    assert.equal(item.height, 1254);
    assert.ok(item.files.pdf.bytes <= 1_000_000);
    if (item.topic === 'gta-6-map') {
      assert.match(item.title, /Concept/);
      assert.match(item.description, /not an official map/);
    }
    if (item.id.includes('download')) assert.match(item.description, /no game or installer/);
  }
});
test('GTA aliases and character names find every reviewed design without duplicate topic routes', () => {
  const topics = [...read('data/topics.json').topics, ...read('data/extra-topics.json')];
  for (const topic of Object.keys(packageContexts))
    assert.equal(topics.filter((x) => x.slug === topic).length, 1);
  assert.ok(!topics.some((x) => x.slug === 'gta-vi'));
  const redirects = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8');
  assert.match(redirects, /^\/clipart\/gta-vi\/? \/clipart\/gta-6\/ 301$/m);
  for (const [query, expected] of [
    ['Jason Duval', 50],
    ['Lucia Caminos', 50],
  ])
    assert.ok(searchArtwork(rows, { ...defaults, q: query, size: 500 }).total >= expected);
  for (const q of ['GTA VI', 'GTA 6', 'Grand Theft Auto'])
    assert.ok(searchArtwork(rows, { ...defaults, q, size: 500 }).total >= 100, q);
});
test(
  'published GTA HTML retains reviewed metadata, canonical URLs and image sitemap entries',
  { skip: !existsSync(new URL('../dist/clipart/gta-6/index.html', import.meta.url)) },
  () => {
    const text = (p) => readFileSync(new URL('../dist/' + p, import.meta.url), 'utf8');
    const sitemap = text('sitemap-images.xml');
    for (const topic of Object.keys(packageContexts)) {
      const html = text('clipart/' + topic + '/index.html');
      const count = rows.filter((item) => item.topic === topic).length;
      assert.ok(html.includes(`"numberOfItems":${count}`), topic);
      assert.ok(!html.includes('{{artworkCount}}'), topic);
    }
    for (const item of rows) {
      const html = text('art/' + item.id + '/index.html');
      assert.ok(html.includes('https://ultraclipart.com/art/' + item.id + '/'));
      assert.ok(
        html.includes(
          JSON.stringify(resolveArtworkCopy(item, editorialReviews.get(item.id)).description).slice(
            1,
            -1,
          ),
        ),
      );
      assert.ok(sitemap.includes('/art/' + item.id + '/'));
      assert.ok(!html.includes('content="noindex'));
    }
    assert.ok(!existsSync(new URL('../dist/clipart/gta-vi/index.html', import.meta.url)));
  },
);
