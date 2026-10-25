import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { defaults, searchArtwork } from '../src/lib/search.ts';
import { cuteConfidence } from '../src/lib/cute-discovery.ts';
import { expansionContexts } from '../scripts/fruit-expansion-copy.mjs';
import { expansionMetadata } from '../scripts/fruit-expansion-metadata.mjs';
const read = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const art = read('data/art.json');
const items = art.filter((x) => x.sourceCollection === 'owner-fruit-expansion-2026-10-24');
const topics = Object.keys(expansionContexts);

test('29 fruit packages retain all 1,450 original pairs with verified PDF transparency and checksums', () => {
  const proof = read('data/fruit-expansion-review.json');
  assert.equal(proof.count, 1450);
  assert.equal(items.length, 1450);
  assert.equal(proof.archives.length, 29);
  assert.equal(proof.screenReview, 'PASS');
  assert.equal(new Set(art.map((x) => x.id)).size, art.length);
  const rows = new Map(proof.rows.map((x) => [x.id, x]));
  for (const item of items) {
    const row = rows.get(item.id);
    assert.ok(row, item.id);
    assert.equal(row.pairedWebp, item.id);
    assert.equal(row.pdfAlphaExact, true);
    assert.equal(row.components, 4);
    assert.equal(row.ppi, 300);
    assert.equal(row.width, item.width);
    assert.equal(row.height, item.height);
    assert.equal(item.sourceType, 'raster');
    assert.equal(item.svg, null);
    assert.equal(item.productionMethod, 'owner-supplied');
    const metadata = expansionMetadata(item.topic, item.id);
    for (const key of ['title', 'alt', 'description', 'style'])
      assert.equal(item[key], metadata[key]);
    assert.ok(item.files.pdf.bytes <= 1_000_000);
    for (const kind of ['pdf', 'webp', 'thumb']) {
      const bytes = readFileSync(new URL('../public' + item[kind], import.meta.url));
      assert.equal(bytes.length, item.files[kind].bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), item.files[kind].sha256);
      if (kind !== 'thumb') assert.equal(item.files[kind].sha256, row.hashes[kind]);
    }
  }
});

test('fruit categories are separate, searchable and have descriptive metadata and real related links', () => {
  const extra = read('data/extra-topics.json'),
    copy = read('data/collection-copy.json');
  const catalogTopics = [...read('data/topics.json').topics, ...extra];
  const secondaryClusters = read('data/topic-clusters.json');
  assert.equal(topics.length, 29);
  for (const topic of topics) {
    const group = items.filter((x) => x.topic === topic);
    assert.equal(group.length, 50);
    assert.equal(catalogTopics.filter((x) => x.slug === topic).length, 1);
    const record = catalogTopics.find((x) => x.slug === topic);
    assert.ok([record.cluster, ...(secondaryClusters[topic] ?? [])].includes('Food & drink'));
    for (const key of ['title', 'alt', 'description'])
      assert.equal(new Set(group.map((x) => x[key])).size, 50);
    const hits = new Set(
      searchArtwork(art, { ...defaults, q: topic.replaceAll('-', ' '), size: 10000 }).items.map(
        (x) => x.id,
      ),
    );
    for (const item of group) {
      assert.ok(hits.has(item.id), item.id);
      assert.ok(item.alt.length > 45 && item.alt.length < 420);
      assert.doesNotMatch(item.alt, /CMYK|prompt|no words|AI-generated|printable fruit clipart/);
      if (/-black-and-white-/.test(item.id))
        assert.ok(['Outline', 'Black & White'].includes(item.style));
    }
    for (const id of copy[topic].featured) assert.ok(group.some((x) => x.id === id));
    for (const neighbor of copy[topic].related) assert.ok(art.some((x) => x.topic === neighbor));
    assert.ok(
      group.some((x) => cuteConfidence(x) >= 68),
      'No cute designs: ' + topic,
    );
    assert.ok(
      group.filter((x) => /-black-and-white-/.test(x.id)).every((x) => cuteConfidence(x) === 0),
    );
  }
  assert.match(copy.date.intro, /date palm/);
  assert.match(copy.melon.intro, /honeydew/i);
  assert.match(copy.cantaloupe.intro, /orange-fleshed/i);
  assert.equal(art.filter((x) => x.topic === 'apple').length, 50);
  for (const [query, topic] of [
    ['cherries', 'cherry'],
    ['blackberries', 'blackberry'],
    ['cranberries', 'cranberry'],
    ['peaches', 'peach'],
    ['mangoes', 'mango'],
    ['figs', 'fig'],
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
  'all new artwork and topic pages expose indexable canonicals, schemas, CDN media and sitemap entries',
  { skip: !existsSync(new URL('../dist/clipart/green-apple/index.html', import.meta.url)) },
  () => {
    const text = (p) => readFileSync(new URL('../dist/' + p, import.meta.url), 'utf8');
    const pages = text('sitemap-pages.xml'),
      images = text('sitemap-images.xml');
    for (const topic of topics) {
      const collection = text(`clipart/${topic}/index.html`);
      assert.ok(collection.includes(`https://ultraclipart.com/clipart/${topic}/`));
      assert.ok(collection.includes('"numberOfItems":50'));
      assert.doesNotMatch(collection, /content="noindex/);
      for (const item of items.filter((x) => x.topic === topic)) {
        const detail = text(`art/${item.id}/index.html`);
        assert.ok(pages.includes(`https://ultraclipart.com/art/${item.id}/`));
        assert.ok(images.includes(`https://ultraclipart.com/art/${item.id}/`));
        assert.ok(detail.includes(`https://ultraclipart.com/art/${item.id}/`));
        assert.match(detail, /ImageObject/);
        assert.match(detail, /assets\.ultraclipart\.com/);
        assert.doesNotMatch(detail, /content="noindex/);
        assert.ok(collection.includes(`/edit/${item.id}/`));
        assert.ok(existsSync(new URL(`../dist/edit/${item.id}/index.html`, import.meta.url)));
        for (const kind of ['pdf', 'webp'])
          assert.ok(detail.includes(`href="/download/${item.id}/?format=${kind}"`));
      }
    }
  },
);
