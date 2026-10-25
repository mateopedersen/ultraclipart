import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { packageContexts, packageMetadata } from '../scripts/thirty-five-part-one-copy.mjs';
import { defaults, searchArtwork } from '../src/lib/search.ts';
import { primaryClusterForTopic, clustersForTopic } from '../src/lib/topic-clusters.ts';
const read = (path) => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const art = read('data/art.json');
const items = art.filter((x) => x.sourceCollection === 'owner-thirty-five-part-one-2026-10-25');
const topics = Object.keys(packageContexts);
test('four supplied packs preserve 200 verified original PDF/WebP pairs', () => {
  const proof = read('data/thirty-five-part-one-review.json');
  assert.equal(items.length, 200);
  assert.equal(proof.count, 200);
  assert.equal(proof.archives.length, 4);
  assert.equal(proof.screenReview, 'PASS');
  const rows = new Map(proof.rows.map((x) => [x.id, x]));
  for (const item of items) {
    const row = rows.get(item.id);
    assert.equal(row.pairedWebp, item.id);
    assert.equal(row.pdfAlphaExact, true);
    assert.equal(row.components, 4);
    assert.equal(row.ppi, 300);
    assert.equal(item.width, 1254);
    assert.equal(item.height, 1254);
    assert.ok(item.files.pdf.bytes <= 1_000_000);
    assert.equal(item.sourceType, 'raster');
    assert.equal(item.svg, null);
    for (const key of ['title', 'alt', 'description', 'style'])
      assert.equal(item[key], packageMetadata(item.topic, item.id)[key]);
    for (const kind of ['webp', 'pdf', 'thumb']) {
      const bytes = readFileSync(new URL('../public' + item[kind], import.meta.url));
      assert.equal(bytes.length, item.files[kind].bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), item.files[kind].sha256);
      if (kind !== 'thumb') assert.equal(item.files[kind].sha256, row.hashes[kind]);
    }
  }
});
test('all four subjects have accurate categories, unique metadata and searchable designs', () => {
  const taxonomy = [...read('data/topics.json').topics, ...read('data/extra-topics.json')];
  const copy = read('data/collection-copy.json');
  for (const topic of topics) {
    const group = items.filter((x) => x.topic === topic);
    assert.equal(group.length, 50);
    assert.equal(taxonomy.filter((x) => x.slug === topic).length, 1);
    assert.equal(
      primaryClusterForTopic(taxonomy.find((x) => x.slug === topic)),
      packageContexts[topic].cluster,
    );
    for (const key of ['title', 'alt', 'description'])
      assert.equal(new Set(group.map((x) => x[key])).size, 50);
    for (const secondary of packageContexts[topic].secondary ?? [])
      assert.ok(clustersForTopic(taxonomy.find((x) => x.slug === topic)).includes(secondary));
    assert.ok(copy[topic].related.every((t) => art.some((x) => x.topic === t)));
    assert.ok(copy[topic].featured.every((id) => group.some((x) => x.id === id)));
    const found = new Set(
      searchArtwork(art, { ...defaults, q: topic, size: 10000 }).items.map((x) => x.id),
    );
    assert.ok(
      group.every((x) => found.has(x.id)),
      topic,
    );
    for (const chip of copy[topic].chips) {
      assert.ok(
        searchArtwork(art, { ...defaults, q: chip.query, size: 20 }).items.some(
          (x) => x.topic === topic,
        ),
        chip.query,
      );
    }
  }
  assert.equal(read('data/production-queue.json').availableArtworkCount, art.length);
});
test(
  'all 200 production pages have canonical URLs, image schema and sitemap entries',
  {
    skip: !existsSync(new URL('../dist/clipart/earth/index.html', import.meta.url)),
  },
  () => {
    const text = (path) => readFileSync(new URL('../dist/' + path, import.meta.url), 'utf8');
    const pages = text('sitemap-pages.xml'),
      images = text('sitemap-images.xml');
    for (const topic of topics) {
      const html = text(`clipart/${topic}/index.html`);
      assert.ok(html.includes(`https://ultraclipart.com/clipart/${topic}/`));
      assert.ok(html.includes('"numberOfItems":50'));
    }
    for (const item of items) {
      const html = text(`art/${item.id}/index.html`);
      assert.ok(html.includes(`https://ultraclipart.com/art/${item.id}/`));
      assert.ok(html.includes('ImageObject'));
      assert.ok(!html.includes('content="noindex'));
      for (const format of ['webp', 'pdf']) {
        assert.ok(html.includes(`download="${item.id}.${format}"`));
        assert.ok(html.includes(item.files[format].sha256));
        assert.ok(html.includes(String(item.files[format].bytes)));
      }
      assert.ok(pages.includes(`/art/${item.id}/`));
      assert.ok(images.includes(`/art/${item.id}/`));
      assert.ok(text(`edit/${item.id}/index.html`).includes('noindex'));
    }
  },
);

test('reviewed cap metadata describes the visible sailor cap', () => {
  const cap = items.find((x) => x.id === 'hat-clipart-vintage-nurse-cap');
  assert.match(cap.title, /Sailor Cap/);
  assert.ok(!cap.title.includes('Nurse'));
});
