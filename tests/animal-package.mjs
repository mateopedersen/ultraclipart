import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { defaults, searchArtwork } from '../src/lib/search.ts';
const read = (path) => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const art = read('data/art.json');
const items = art.filter(
  (item) =>
    item.sourceCollection === 'owner-animal-2026-10-23' ||
    item.replacesArtwork?.sourceCollection === 'owner-animal-2026-10-23',
);
const hasPackage = items.length > 0;
test(
  'supplied animal package rejects held designs and preserves every verified source pair',
  { skip: !hasPackage },
  () => {
    const review = read('data/animal-package-review.json'),
      publication = read('data/publication.json');
    assert.equal(items.length, 2500);
    assert.equal(review.screenReview, 'PASS');
    assert.equal(review.heldIds.length, 0);
    assert.equal(review.repairedIds.length, 22);
    assert.equal(new Set(items.map((item) => item.alt)).size, 2500);
    for (const id of review.repairedIds) assert.ok(items.some((item) => item.id === id));
    const held = new Set(review.heldIds),
      proofs = new Map(review.rows.map((row) => [row.id, row]));
    for (const file of publication.files) assert.ok(!held.has(file.assetId));
    for (const item of art) assert.ok(!held.has(item.id));
    for (const item of items) {
      const proof = proofs.get(item.id);
      assert.equal(item.sourceType, 'raster');
      assert.equal(item.svg, null);
      assert.equal(proof.pairedWebp, item.id);
      assert.equal(proof.components, 4);
      assert.equal(proof.pdfAlphaExact, true);
      assert.equal(proof.ppi, 300);
      assert.ok(item.files.pdf.bytes <= 1_000_000);
      if (item.replacesArtwork) {
        const lineage = item.replacesArtwork;
        assert.equal(lineage.pdfSha256, proof.hashes.pdf);
        assert.equal(lineage.webpSha256, proof.hashes.webp);
        assert.equal(item.revision, lineage.revision + 1);
        assert.equal(item.productionMethod, 'generated-raster');
        const wave = read(`data/waves/${item.sourceCollection}.json`);
        const replacement = wave.artworks.find((row) => row.id === item.id);
        assert.equal(wave.screenReview, 'PASS');
        assert.equal(replacement.webpExactRgba, true);
        assert.equal(replacement.pdfAlphaExact, true);
        assert.equal(replacement.nativeResolutionPreserved, true);
        assert.equal(replacement.image.colorSpace, 'Device CMYK');
        assert.equal(replacement.image.components, 4);
        for (const kind of ['pdf', 'webp', 'thumb'])
          assert.equal(replacement.files[kind].sha256, item.files[kind].sha256);
        assert.notEqual(item.files.webp.sha256, lineage.webpSha256);
        assert.notEqual(item.files.pdf.sha256, lineage.pdfSha256);
      } else {
        assert.equal(item.files.pdf.sha256, proof.hashes.pdf);
        assert.equal(item.files.webp.sha256, proof.hashes.webp);
      }
      assert.doesNotMatch(
        item.alt,
        /described below|CMYK|no words|no digits|review copy|\b(?:with|and)\./i,
      );
      for (const kind of ['pdf', 'webp', 'thumb']) {
        const body = readFileSync(new URL('../public' + item[kind], import.meta.url));
        assert.equal(body.length, item.files[kind].bytes);
        assert.equal(createHash('sha256').update(body).digest('hex'), item.files[kind].sha256);
      }
    }
  },
);
test('animal topic counts and source-specific search stay honest', { skip: !hasPackage }, () => {
  const topics = new Set(items.map((item) => item.topic));
  assert.equal(topics.size, 50);
  const copy = read('data/collection-copy.json');
  for (const topic of topics) {
    const group = items.filter((item) => item.topic === topic);
    assert.equal(group.length, 50);
    const hits = searchArtwork(art, {
      ...defaults,
      q: topic.replaceAll('-', ' '),
      size: 10000,
    }).items;
    for (const item of group)
      assert.ok(
        hits.some((hit) => hit.id === item.id),
        item.id,
      );
    assert.ok(copy[topic].intro.length > 150);
    for (const id of copy[topic].featured) assert.ok(group.some((item) => item.id === id));
  }
  const queue = read('data/production-queue.json');
  for (const topic of ['penguin', 'squirrel']) {
    const expected = items.filter((item) => item.topic === topic);
    const actual = queue.topics.find((item) => item.topic === topic);
    assert.equal(actual.available, 50);
    assert.equal(
      actual.supplied,
      expected.filter((item) => item.productionMethod === 'owner-supplied').length,
    );
    assert.equal(
      actual.generated,
      expected.filter((item) => item.productionMethod === 'generated-raster').length,
    );
  }
});
test(
  'all animal detail pages expose their matching download and editor; held routes are absent',
  {
    skip: !hasPackage || !existsSync(new URL('../dist/clipart/zebra/index.html', import.meta.url)),
  },
  () => {
    const review = read('data/animal-package-review.json');
    for (const item of items) {
      const html = readFileSync(
        new URL('../dist/art/' + item.id + '/index.html', import.meta.url),
        'utf8',
      );
      assert.ok(html.includes(`https://ultraclipart.com/art/${item.id}/`));
      assert.ok(html.includes(`/edit/${item.id}/`));
      assert.ok(html.includes(`download="${item.id}.webp"`));
      assert.ok(html.includes(`download="${item.id}.pdf"`));
      assert.match(html, /ImageObject/);
      assert.ok(existsSync(new URL('../dist/edit/' + item.id + '/index.html', import.meta.url)));
    }
    for (const id of review.heldIds)
      for (const type of ['art', 'edit'])
        assert.equal(
          existsSync(new URL(`../dist/${type}/${id}/index.html`, import.meta.url)),
          false,
        );
    for (const topic of new Set(items.map((item) => item.topic))) {
      const html = readFileSync(
        new URL(`../dist/clipart/${topic}/index.html`, import.meta.url),
        'utf8',
      );
      assert.doesNotMatch(html, /content="noindex/);
    }
  },
);
