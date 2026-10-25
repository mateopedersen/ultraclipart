import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { defaults, searchArtwork } from '../src/lib/search.ts';
const read = (path) => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const art = read('data/art.json');
const items = art.filter((item) => item.sourceCollection === 'owner-fruit-2026-10-24');
const topics = [
  'apple',
  'banana',
  'orange',
  'strawberry',
  'raspberry',
  'blueberry',
  'avocado',
  'coconut',
  'kiwi-fruit',
  'mandarin',
  'tangerine',
];
test('fruit intake preserves all 550 independently verified PDF/WebP pairs', () => {
  const proof = read('data/fruit-package-review.json');
  assert.equal(items.length, 550);
  assert.equal(proof.count, 550);
  assert.equal(proof.screenReview, 'PASS');
  const checked = new Map(proof.rows.map((row) => [row.id, row]));
  for (const item of items) {
    const row = checked.get(item.id);
    assert.ok(row, item.id);
    assert.equal(item.productionMethod, 'owner-supplied');
    assert.equal(item.sourceType, 'raster');
    assert.equal(row.pairedWebp, item.id);
    assert.equal(row.components, 4);
    assert.equal(row.pdfAlphaExact, true);
    assert.equal(row.ppi, 300);
    assert.equal(item.width, row.width);
    assert.equal(item.height, row.height);
    assert.ok(item.files.pdf.bytes <= 1_000_000);
    for (const kind of ['webp', 'pdf', 'thumb']) {
      const bytes = readFileSync(new URL('../public' + item[kind], import.meta.url));
      assert.equal(bytes.length, item.files[kind].bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), item.files[kind].sha256);
      if (kind !== 'thumb') assert.equal(item.files[kind].sha256, row.hashes[kind]);
    }
    assert.ok(item.alt.length > 30 && item.alt.length < 420);
    assert.doesNotMatch(item.alt, /CMYK|pixels per inch|no words|described below|AI-generated/);
  }
});
test('fruit categories have real counts, discoverable entries and separate kiwi fruit/bird routes', () => {
  const extra = read('data/extra-topics.json');
  const copy = read('data/collection-copy.json');
  assert.equal(new Set(extra.map((t) => t.id)).size, extra.length);
  for (const topic of topics) {
    const group = items.filter((a) => a.topic === topic);
    assert.equal(group.length, 50);
    assert.equal(new Set(group.map((a) => a.alt)).size, 50);
    const hits = new Set(
      searchArtwork(art, { ...defaults, q: topic.replaceAll('-', ' '), size: 10000 }).items.map(
        (a) => a.id,
      ),
    );
    for (const item of group) assert.ok(hits.has(item.id), item.id);
    for (const id of copy[topic].featured) assert.ok(group.some((a) => a.id === id));
    for (const related of copy[topic].related) assert.ok(art.some((a) => a.topic === related));
  }
  assert.equal(art.filter((a) => a.topic === 'kiwi').length, 50);
  assert.ok(art.filter((a) => a.topic === 'kiwi').every((a) => a.id.startsWith('kiwi-bird-')));
  const queue = read('data/production-queue.json');
  assert.equal(queue.targetBasis, 'GENERATED_ARTWORKS_IN_ORIGINAL_110_TOPICS');
  const apple = queue.topics.find((t) => t.topic === 'apple');
  assert.equal(apple.supplied, 50);
  assert.equal(
    apple.generated,
    art.filter((a) => a.topic === 'apple' && a.productionMethod !== 'owner-supplied').length,
  );
  assert.equal(apple.remainingToDraw, 50 - apple.generated);
});
test(
  'all fruit pages expose matching media, edit routes, canonical and image sitemap entries',
  { skip: !existsSync(new URL('../dist/clipart/apple/index.html', import.meta.url)) },
  () => {
    const text = (path) => readFileSync(new URL('../dist/' + path, import.meta.url), 'utf8');
    for (const topic of topics) {
      const collection = text(`clipart/${topic}/index.html`);
      assert.ok(collection.includes(`https://ultraclipart.com/clipart/${topic}/`));
      assert.ok(
        collection.includes(`"numberOfItems":${art.filter((a) => a.topic === topic).length}`),
      );
      assert.doesNotMatch(collection, /content="noindex/);
      for (const item of items.filter((a) => a.topic === topic)) {
        const detail = text(`art/${item.id}/index.html`);
        assert.ok(text('sitemap-images.xml').includes(`https://ultraclipart.com/art/${item.id}/`));
        assert.ok(text('sitemap-pages.xml').includes(`https://ultraclipart.com/art/${item.id}/`));
        assert.ok(collection.includes(`/edit/${item.id}/`));
        assert.ok(detail.includes(`https://ultraclipart.com/art/${item.id}/`));
        assert.match(detail, /ImageObject/);
        for (const kind of ['pdf', 'webp'])
          assert.ok(detail.includes(`href="/download/${item.id}/?format=${kind}"`));
        assert.ok(existsSync(new URL(`../dist/edit/${item.id}/index.html`, import.meta.url)));
      }
    }
  },
);
