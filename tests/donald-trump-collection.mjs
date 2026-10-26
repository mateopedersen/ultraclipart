import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const read = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const hash = (body) => createHash('sha256').update(body).digest('hex');
const report = read('data/donald-trump-collection-review.json');
const registry = read('data/identification/donald-trump-100.json');

test('all 100 reviewed Trump scenes keep original paired files and source-bound identity metadata', () => {
  assert.equal(report.count, 100);
  assert.equal(report.originalWebPsPreserved, 100);
  assert.equal(report.originalPdfsPreserved, 100);
  assert.equal(report.repairedPdfs, 0);
  assert.equal(report.items.length, 100);
  assert.equal(new Set(report.items.map((x) => x.id)).size, 100);
  assert.equal(new Set(report.items.map((x) => x.title)).size, 100);
  for (const item of report.items) {
    const review = registry.artworks.find((x) => x.id === item.id);
    assert.equal(review.status, 'PASS');
    assert.equal(review.level, 'public-figure-illustration');
    assert.equal(review.sceneType, 'imagined-illustration');
    assert.equal(review.sourceSha256, item.files.webp.sha256);
    assert(review.reviewedFromPixels);
    for (const field of ['title', 'alt', 'description'])
      assert.equal(item[field], review.metadata[field]);
    for (const kind of ['webp', 'pdf', 'thumb']) {
      const bytes = readFileSync(new URL('../public' + item[kind], import.meta.url));
      assert.equal(hash(bytes), item.files[kind].sha256);
      assert.equal(bytes.length, item.files[kind].bytes);
    }
    assert.equal(item.topic, 'donald-trump');
    assert.equal(item.sourceType, 'raster');
    assert.equal(item.svg, null);
    assert.equal(item.discovery.cute, false);
    assert.doesNotMatch(
      item.description,
      /The scene is an imagined illustration|AI.generated|real generated examples/i,
    );
    assert.doesNotMatch(
      item.title + ' ' + item.description,
      /AI.generated|FLUX|real generated|officially endorsed|confirmed event/i,
    );
  }
});

test('all 100 PDFs preserve their actual 300-PPI print scale and alpha', () => {
  assert.equal(report.rows.length, 100);
  assert.equal(report.rows.filter((x) => x.suppliedPrintResizeSteps > 0).length, 14);
  for (const proof of report.rows) {
    const item = report.items.find((x) => x.id === proof.id);
    assert.equal(proof.pairedWebp, item.id);
    assert.equal(proof.ppi, 300);
    assert(proof.pdfAlphaExactToPrintSource);
    assert(proof.nativeWebpUnchanged && proof.suppliedPdfUnchanged);
    assert.equal(proof.hashes.pdf, item.files.pdf.sha256);
    assert.equal(proof.hashes.webp, item.files.webp.sha256);
    assert(item.files.pdf.bytes <= 1000000);
    assert(Math.abs(proof.printDimensions[0] / (proof.pagePoints[0] / 72) - 300) < 0.01);
    assert(Math.abs(proof.printDimensions[1] / (proof.pagePoints[1] / 72) - 300) < 0.01);
  }
});

test('copy follows the depicted scene and the duplicate review covers the accepted catalog', () => {
  assert.equal(report.items.filter((x) => x.style === 'Black & White').length, 20);
  assert.equal(report.exactDuplicateReview.status, 'PASS');
  assert(report.exactDuplicateReview.baseline >= 12904);
  assert.deepEqual(report.exactDuplicateReview.collisions, []);
  assert.equal(report.perceptualReview.status, 'PASS');
  assert.equal(report.perceptualReview.decisions.length, report.perceptualReview.candidates.length);
  assert(
    report.perceptualReview.decisions.every(
      (x) => x.reviewedFromActualPairSheet && x.status === 'DISTINCT_COMPOSITION',
    ),
  );
  assert.doesNotMatch(
    report.items.find((x) => x.id === 'donald-trump-oval-office-armchair-clipart').title,
    /Oval Office/,
  );
  assert.match(
    report.items.find((x) => x.id === 'donald-trump-weather-vane-clipart').title,
    /Wind Gauge/,
  );
  assert.match(
    report.items.find((x) => x.id === 'donald-trump-roadmap-presentation-clipart').title,
    /United States Map/,
  );
  assert(
    report.items
      .filter((x) => x.id.includes('melania'))
      .every((x) => x.title.includes('Melania Trump') && x.alt.includes('Melania Trump')),
  );
});
