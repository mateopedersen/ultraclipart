import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const read = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const art = read('data/art.json');
const items = art.filter((x) => x.sourceCollection === 'owner-brain-50-2026-10-26');
const report = read('data/brain-collection-review.json');
const registry = read('data/identification/brain-50.json');
test('all 50 brain scenes retain their reviewed native files and matching descriptive metadata', () => {
  assert.equal(items.length, 50);
  assert.equal(report.originalWebPsPreserved, 50);
  assert.equal(report.originalPdfsPreserved, 49);
  assert.equal(new Set(items.map((x) => x.title)).size, 50);
  for (const item of items) {
    const r = registry.artworks.find((x) => x.id === item.id);
    const bytes = readFileSync(new URL('../public' + item.webp, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), r.sourceSha256);
    for (const k of ['title', 'alt', 'description']) assert.equal(item[k], r.metadata[k]);
    assert.equal(item.sourceType, 'raster');
    assert.equal(item.topic, 'brain');
    assert.doesNotMatch(
      item.title + ' ' + item.description,
      /clinically verified|medical-grade|AI-generated|FLUX|real generated/i,
    );
  }
  assert.equal(items.filter((x) => x.style === 'Black & White').length, 10);
  assert.match(
    items.find((x) => x.id === 'brain-two-hemispheres-clipart').title,
    /Mirrored Brain Cutaway Views/,
  );
});
test('native PDF page scale and the single repaired print edition are reported honestly', () => {
  assert.equal(report.repairs.length, 1);
  assert.equal(report.repairs[0].id, 'brain-and-hourglass-clipart');
  for (const item of items) {
    const p = report.rows.find((x) => x.id === item.id);
    assert.equal(p.pairedWebp, item.id);
    assert(p.pdfAlphaExactToPrintSource);
    assert.equal(p.hashes.pdf, item.files.pdf.sha256);
    assert.equal(p.hashes.webp, item.files.webp.sha256);
    assert.deepEqual(p.pagePoints, [144, 144]);
    assert.equal(p.ppi, item.id === 'brain-and-hourglass-clipart' ? 425 : 750);
    assert(item.files.pdf.bytes <= 1000000);
  }
  const topics = [...read('data/topics.json').topics, ...read('data/extra-topics.json')];
  assert.equal(topics.filter((x) => x.slug === 'brain').length, 1);
  assert.equal(topics.find((x) => x.slug === 'brain').cluster, 'Space & science');
  assert.equal(report.perceptualReview.status, 'PASS');
  assert(
    report.perceptualReview.decisions.every(
      (x) => x.reviewedFromActualPairSheet && x.status === 'DISTINCT_COMPOSITION',
    ),
  );
});
