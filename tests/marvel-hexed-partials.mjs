import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateIdentification } from '../scripts/identification-review.mjs';
const read = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url))),
  art = read('data/art.json'),
  report = read('data/marvel-hexed-partials-review.json'),
  registry = read('data/identification/marvel-hexed-partials.json'),
  items = art.filter((x) => x.sourceCollection === report.collection),
  plan = read('design-assets/marvel-completion/pending-prompt-set.json');
test('ready partial sources publish only actual artwork and preserve 134 deferred slots', () => {
  assert.equal(items.length, 28);
  assert.equal(report.alreadyPublishedIdentical, 36);
  assert.equal(report.completedDrawingsGenerated, 0);
  assert.equal(report.completeFiftyDesignSets, false);
  assert.equal(report.pendingTotal, 134);
  assert.equal(plan.outputs.length, 134);
  assert.equal(new Set(plan.outputs.map((x) => x.id)).size, 134);
  for (const [t, n] of Object.entries({ avengers: 11, 'avengers-doomsday': 2, 'doctor-doom': 3 }))
    assert.equal(items.filter((x) => x.topic === t).length, n);
  assert.equal(items.filter((x) => x.topic === 'hexed').length, 12);
});
test('visible character identities, metadata and concept labels match source hashes', () => {
  for (const a of items) {
    const r = registry.artworks.find((x) => x.id === a.id);
    assert(r);
    assert.equal(a.title, r.metadata.title);
    assert.equal(a.alt, r.metadata.alt);
    assert.equal(a.description, r.metadata.description);
    const sourceBytes = readFileSync(new URL('../public' + a.webp, import.meta.url));
    validateIdentification({ artwork: a, record: r, sourceBytes });
    assert.throws(
      () =>
        validateIdentification({ artwork: a, record: r, sourceBytes: Buffer.from('replacement') }),
      /source changed/,
    );
    if (a.topic === 'hexed' || a.topic === 'avengers-doomsday') assert.match(a.title, /Concept/);
    assert.doesNotMatch(
      a.title + ' ' + a.alt + ' ' + a.description,
      /FLUX|AI-generated|real generated example/i,
    );
  }
});
test('all supplied new PDF files have exact native alpha and matching visible content', () => {
  assert.equal(report.rows.length, 28);
  for (const p of report.rows) {
    const a = items.find((x) => x.id === p.id);
    assert.equal(p.ppi, 300);
    assert(p.pdfAlphaExact);
    assert(p.pdfAlphaExactToPrintSource);
    assert.equal(p.pairedWebp, a.id);
    assert.equal(p.hashes.webp, a.files.webp.sha256);
    assert.equal(p.hashes.pdf, a.files.pdf.sha256);
    assert(a.files.pdf.bytes <= 1_000_000);
  }
  assert.equal(report.authoredPdfProofs.length, 28);
  assert.equal(report.perceptualReview.status, 'PASS');
  assert(
    report.perceptualReview.candidates.every(
      (x) => x.status === 'DISTINCT_COMPOSITION' && x.reviewedFromActualPairSheet,
    ),
  );
});
