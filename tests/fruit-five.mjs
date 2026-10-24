import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fiveContexts } from '../scripts/fruit-five-copy.mjs';
import { expansionMetadata } from '../scripts/fruit-expansion-metadata.mjs';
import { defaults, searchArtwork } from '../src/lib/search.ts';
const read = (path) => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const art = read('data/art.json');
const items = art.filter((x) => x.sourceCollection === 'owner-fruit-five-packs-2026-10-24');
const topics = Object.keys(fiveContexts);
test('five nested fruit packs preserve 250 paired originals and descriptive metadata', () => {
  const proof = read('data/fruit-five-review.json');
  assert.equal(proof.count, 250);
  assert.equal(proof.archives.length, 5);
  assert.equal(proof.screenReview, 'PASS');
  assert.equal(items.length, 250);
  assert.equal(topics.length, 5);
  const rows = new Map(proof.rows.map((x) => [x.id, x]));
  for (const item of items) {
    const row = rows.get(item.id);
    assert.ok(row, item.id);
    assert.equal(row.pairedWebp, item.id);
    assert.equal(row.pdfAlphaExact, true);
    assert.equal(row.components, 4);
    assert.equal(row.ppi, 300);
    assert.equal(item.productionMethod, 'owner-supplied');
    for (const key of ['title', 'alt', 'description', 'style'])
      assert.equal(item[key], expansionMetadata(item.topic, item.id)[key]);
    for (const kind of ['webp', 'pdf', 'thumb']) {
      const bytes = readFileSync(new URL('../public' + item[kind], import.meta.url));
      assert.equal(bytes.length, item.files[kind].bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), item.files[kind].sha256);
      if (kind !== 'thumb') assert.equal(item.files[kind].sha256, row.hashes[kind]);
    }
  }
});
test('new subjects have one Food category, 50 searchable designs and unique text', () => {
  const extra = read('data/extra-topics.json'),
    copy = read('data/collection-copy.json');
  for (const topic of topics) {
    const group = items.filter((x) => x.topic === topic);
    assert.equal(group.length, 50);
    assert.equal(extra.filter((x) => x.slug === topic && x.cluster === 'Food & drink').length, 1);
    for (const key of ['title', 'alt', 'description'])
      assert.equal(new Set(group.map((x) => x[key])).size, 50);
    assert.equal(copy[topic].featured.length > 0, true);
    assert.ok(copy[topic].related.every((t) => art.some((x) => x.topic === t)));
  }
  for (const [query, topic] of [
    ['star fruit', 'starfruit'],
    ['starfruits', 'starfruit'],
    ['mulberries', 'mulberry'],
    ['kumquats', 'kumquat'],
    ['quinces', 'quince'],
    ['gooseberries', 'gooseberry'],
  ]) {
    const found = new Set(
      searchArtwork(art, { ...defaults, q: query, size: 10000 }).items.map((x) => x.id),
    );
    assert.ok(
      items.filter((x) => x.topic === topic).every((x) => found.has(x.id)),
      query,
    );
  }
});
test(
  'all 250 new pages have searchable, indexable production output',
  {
    skip: !existsSync(new URL('../dist/clipart/starfruit/index.html', import.meta.url)),
  },
  () => {
    const text = (path) => readFileSync(new URL('../dist/' + path, import.meta.url), 'utf8');
    const pages = text('sitemap-pages.xml'),
      images = text('sitemap-images.xml');
    for (const topic of topics) {
      const html = text(`clipart/${topic}/index.html`);
      assert.ok(html.includes(`https://ultraclipart.com/clipart/${topic}/`));
      assert.ok(html.includes('"numberOfItems":50'));
      for (const item of items.filter((x) => x.topic === topic)) {
        const detail = text(`art/${item.id}/index.html`);
        assert.ok(pages.includes(`/art/${item.id}/`));
        assert.ok(images.includes(`/art/${item.id}/`));
        assert.ok(detail.includes(`https://ultraclipart.com/art/${item.id}/`));
        assert.ok(detail.includes('ImageObject'));
        assert.ok(detail.includes('assets.ultraclipart.com'));
        assert.ok(!detail.includes('content="noindex'));
        assert.ok(existsSync(new URL(`../dist/edit/${item.id}/index.html`, import.meta.url)));
      }
    }
  },
);
