import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { schoolMetadata } from '../scripts/school-copy.mjs';
import { defaults, searchArtwork } from '../src/lib/search.ts';

const read = (path) => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const all = read('data/art.json');
const items = all.filter((item) => item.sourceCollection === 'owner-school-pack-2026-10-24');

test('school pack has 50 real PDF/WebP pairs, including six documented PDF repairs', () => {
  const review = read('data/school-review.json');
  assert.equal(review.count, 50);
  assert.equal(review.screenReview, 'PASS');
  assert.equal(review.archives.length, 1);
  assert.equal(review.repairs.length, 6);
  assert.equal(review.repairs.filter((repair) => repair.reason.includes('zero-byte')).length, 5);
  assert.equal(items.length, 50);
  const rows = new Map(review.rows.map((row) => [row.id, row]));
  for (const item of items) {
    const row = rows.get(item.id);
    assert.ok(row, item.id);
    assert.equal(row.pdfAlphaExact, true);
    assert.equal(row.components, 4);
    assert.equal(row.ppi, 750);
    assert.equal(row.pairedWebp, item.id);
    for (const key of ['title', 'alt', 'description', 'style'])
      assert.equal(item[key], schoolMetadata(item.id)[key]);
    for (const kind of ['webp', 'pdf', 'thumb']) {
      const body = readFileSync(new URL('../public' + item[kind], import.meta.url));
      assert.equal(body.length, item.files[kind].bytes);
      assert.equal(createHash('sha256').update(body).digest('hex'), item.files[kind].sha256);
      if (kind !== 'thumb') assert.equal(item.files[kind].sha256, row.hashes[kind]);
    }
    if (review.repairs.some((repair) => repair.id === item.id))
      assert.match(item.provenance, /WebP reconstructed from this PDF/);
  }
});

test('School & learning has truthful copy and all 50 designs are searchable', () => {
  const extra = read('data/extra-topics.json');
  const copy = read('data/collection-copy.json');
  assert.equal(
    extra.filter((topic) => topic.slug === 'school' && topic.cluster === 'School & learning')
      .length,
    1,
  );
  assert.equal(new Set(items.map((item) => item.title)).size, 50);
  assert.equal(new Set(items.map((item) => item.alt)).size, 50);
  assert.equal(copy.school.featured.length, 6);
  assert.ok(copy.school.related.every((topic) => all.some((item) => item.topic === topic)));
  const results = searchArtwork(all, { ...defaults, q: 'school', size: 10000 }).items;
  const found = new Set(results.map((item) => item.id));
  assert.ok(items.every((item) => found.has(item.id)));
});

test(
  'school category and all artwork pages are indexable with media and editors',
  {
    skip: !existsSync(new URL('../dist/clipart/school/index.html', import.meta.url)),
  },
  () => {
    const text = (path) => readFileSync(new URL('../dist/' + path, import.meta.url), 'utf8');
    const page = text('clipart/school/index.html');
    assert.ok(page.includes('https://ultraclipart.com/clipart/school/'));
    assert.ok(page.includes('"numberOfItems":50'));
    const pages = text('sitemap-pages.xml');
    const images = text('sitemap-images.xml');
    for (const item of items) {
      const detail = text(`art/${item.id}/index.html`);
      assert.ok(pages.includes(`/art/${item.id}/`));
      assert.ok(images.includes(`/art/${item.id}/`));
      assert.ok(detail.includes('ImageObject'));
      assert.ok(detail.includes('assets.ultraclipart.com'));
      assert.ok(!detail.includes('content="noindex'));
      assert.ok(existsSync(new URL(`../dist/edit/${item.id}/index.html`, import.meta.url)));
    }
  },
);
