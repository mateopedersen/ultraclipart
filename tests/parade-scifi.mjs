import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { validateIdentification } from '../scripts/identification-review.mjs';
const read = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url))),
  art = read('data/art.json'),
  registry = read('data/identification/parade-scifi.json'),
  report = read('data/parade-scifi-review.json'),
  items = art.filter((x) => x.sourceCollection === 'owner-parade-scifi-2026-10-26'),
  topics = [...read('data/topics.json').topics, ...read('data/extra-topics.json')];
test('parade package adds only 454 new compositions and reuses existing subjects', () => {
  assert.equal(items.length, 454);
  assert.equal(new Set(art.map((x) => x.id)).size, art.length);
  assert.equal(new Set(items.map((x) => x.topic)).size, 11);
  for (const t of ['hexed', 'mockingjay'])
    assert.equal(topics.filter((x) => x.slug === t).length, 1);
  assert.equal(report.alreadyPublishedIdentical, 235);
  assert.equal(report.olderSuppliedSourcesNotReverted, 11);
  assert.equal(report.replacedCompositions, 31);
  assert.equal(report.authoredPdfProofs.length, 39);
});
test('reviewed scene identities and concept labels stay bound to actual image bytes', () => {
  for (const x of items) {
    const r = registry.artworks.find((r) => r.id === x.id),
      bytes = readFileSync(new URL('../public' + x.webp, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), r.sourceSha256);
    assert.equal(x.title, r.metadata.title);
    assert.equal(x.alt, r.metadata.alt);
    assert.equal(x.description, r.metadata.description);
    if (r.level !== 'generic-subject') {
      validateIdentification({ artwork: x, sourceBytes: bytes, record: r });
      assert.throws(
        () =>
          validateIdentification({
            artwork: x,
            sourceBytes: Buffer.from('changed source'),
            record: r,
          }),
        /source changed/,
      );
    }
    if (x.topic === 'dune-part-three' || x.topic === 'hexed') assert.match(x.title, /Concept/);
    assert.doesNotMatch(
      x.title + ' ' + x.alt + ' ' + x.description,
      /FLUX|real generated|AI-generated|Elias|Farok/i,
    );
  }
});
test('native artwork and separate print editions have matching verified downloads', () => {
  for (const x of items) {
    const p = report.rows.find((p) => p.id === x.id);
    assert.equal(p.ppi, 300);
    assert.equal(p.pairedWebp, x.id);
    assert(p.pdfAlphaExactToPrintSource);
    assert.equal(p.hashes.webp, x.files.webp.sha256);
    assert.equal(p.hashes.pdf, x.files.pdf.sha256);
    assert(x.files.pdf.bytes <= 1_000_000);
    assert.deepEqual(p.dimensions, [x.width, x.height]);
  }
  for (const x of report.drawings) {
    assert.equal(x.generator, 'built-in image_gen');
    assert.equal(x.dimensions.length, 2);
    assert(x.sourcePngSha256 && x.printSourceSha256);
  }
});
test('existing reviewed compositions are not reverted by older archive versions', () => {
  for (const x of report.preservedExisting) {
    const a = art.find((a) => a.id === x.id);
    assert.equal(a.files.webp.sha256, x.publishedSha256);
    assert.notEqual(a.files.webp.sha256, x.sourceSha256);
    assert.notEqual(a.sourceCollection, report.collection);
  }
  assert.equal(report.preservedExisting.length, 11);
  assert.equal(report.perceptualReview.status, 'PASS');
  assert(
    report.perceptualReview.candidates.every(
      (x) => x.reviewedFromActualPairSheet && x.status === 'DISTINCT_COMPOSITION',
    ),
  );
});
