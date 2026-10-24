import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fireLeafMetadata } from '../scripts/fire-leaf-copy.mjs';
import { defaults, searchArtwork } from '../src/lib/search.ts';

const read = (path) => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const all = read('data/art.json');
const items = all.filter(
  (item) => item.sourceCollection === 'owner-fire-leaf-two-packs-2026-10-24',
);
const proof = read('data/fire-leaf-review.json');

test('the two owner packs preserve 100 paired, technically reviewed originals', () => {
  assert.equal(proof.count, 100);
  assert.equal(proof.archives.length, 2);
  assert.equal(proof.screenReview, 'PASS');
  assert.equal(items.length, 100);
  const rows = new Map(proof.rows.map((row) => [row.id, row]));
  for (const item of items) {
    const row = rows.get(item.id);
    assert.ok(row, item.id);
    assert.equal(row.pdfAlphaExact, true);
    assert.equal(row.components, 4);
    assert.equal(row.ppi, 300);
    assert.equal(row.pairedWebp, item.id);
    assert.equal(item.topic, item.id.startsWith('leaf-') ? 'leaves' : 'fire');
    for (const key of ['title', 'alt', 'description', 'style'])
      assert.equal(item[key], fireLeafMetadata(item.id.split('-')[0], item.id)[key]);
    for (const kind of ['webp', 'pdf', 'thumb']) {
      const bytes = readFileSync(new URL('../public' + item[kind], import.meta.url));
      assert.equal(bytes.length, item.files[kind].bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), item.files[kind].sha256);
      if (kind !== 'thumb') assert.equal(item.files[kind].sha256, row.hashes[kind]);
    }
  }
});

test('fire and leaves appear in their own relevant catalog destinations', () => {
  const topics = read('data/topics.json').topics;
  const extra = read('data/extra-topics.json');
  const secondary = read('data/topic-clusters.json');
  const copy = read('data/collection-copy.json');
  assert.equal(new Set([...topics, ...extra].map((x) => x.id)).size, topics.length + extra.length);
  assert.equal(
    extra.filter((x) => x.slug === 'fire' && x.cluster === 'Nature & elements').length,
    1,
  );
  assert.equal(topics.find((x) => x.slug === 'leaves').cluster, 'Thanksgiving & Autumn');
  assert.ok(secondary.leaves.includes('Nature & elements'));
  for (const topic of ['fire', 'leaves']) {
    const group = items.filter((x) => x.topic === topic);
    assert.equal(group.length, 50);
    for (const key of ['title', 'alt', 'description'])
      assert.equal(new Set(group.map((x) => x[key])).size, 50);
    assert.equal(copy[topic].featured.length, 6);
    assert.ok(copy[topic].related.every((t) => all.some((x) => x.topic === t)));
  }
  for (const [query, topic] of [
    ['fire', 'fire'],
    ['leaf', 'leaves'],
    ['leaves', 'leaves'],
  ]) {
    const found = new Set(
      searchArtwork(all, { ...defaults, q: query, size: 10000 }).items.map((x) => x.id),
    );
    assert.ok(
      items.filter((x) => x.topic === topic).every((x) => found.has(x.id)),
      query,
    );
  }
});

test(
  'every new page has an indexable URL, image sitemap entry and editor',
  {
    skip: !existsSync(new URL('../dist/clipart/fire/index.html', import.meta.url)),
  },
  () => {
    const text = (path) => readFileSync(new URL('../dist/' + path, import.meta.url), 'utf8');
    const pages = text('sitemap-pages.xml');
    const images = text('sitemap-images.xml');
    for (const topic of ['fire', 'leaves']) {
      const html = text(`clipart/${topic}/index.html`);
      assert.ok(html.includes(`https://ultraclipart.com/clipart/${topic}/`));
      assert.ok(html.includes('"numberOfItems":50'));
      for (const item of items.filter((x) => x.topic === topic)) {
        const detail = text(`art/${item.id}/index.html`);
        assert.ok(pages.includes(`/art/${item.id}/`));
        assert.ok(images.includes(`/art/${item.id}/`));
        assert.ok(detail.includes('ImageObject'));
        assert.ok(detail.includes('assets.ultraclipart.com'));
        assert.ok(!detail.includes('content="noindex'));
        assert.ok(existsSync(new URL(`../dist/edit/${item.id}/index.html`, import.meta.url)));
      }
    }
  },
);
