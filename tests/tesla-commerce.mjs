import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEditorialReview } from '../scripts/artwork-editorial.mjs';
import { reviewedImportCatalog } from '../scripts/reviewed-imports.mjs';
import { validateCollectionCopy } from '../scripts/collection-editorial.mjs';
import { reviewedProductMetadata } from '../scripts/product-identity.mjs';
const read = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const report = read('data/tesla-commerce-collection-review.json');
const items = read('data/art.json').filter((x) => x.sourceCollection === report.collection);
const identities = read('data/identification/tesla-commerce-550.json');
const registry = read('data/editorial/reviews.json');
const reviews = new Map(registry.artworks.map((x) => [x.id, x]));

test('550 accepted supplied pairs retain original bytes, distinct metadata and complete representations', () => {
  assert.equal(items.length, 550);
  assert.equal(report.originalPdfsPreserved, 550);
  assert.equal(report.originalWebPsPreserved, 550);
  assert.equal(report.generated, 0);
  assert.equal(report.repairedPdfs, 0);
  assert.equal(new Set(items.map((x) => x.title)).size, 550);
  assert.equal(report.exactDuplicateReview.status, 'PASS');
  assert.deepEqual(report.exactDuplicateReview.collisions, []);
  assert(report.exactDuplicateReview.baseline >= 13034);
  assert.equal(report.perceptualReview.status, 'PASS');
  assert.equal(report.perceptualReview.candidates.length, report.perceptualReview.decisions.length);
  assert.equal(report.concurrentDeltaReview.status, 'PASS');
  for (const item of items) {
    const proof = report.rows.find((x) => x.id === item.id);
    assert.equal(proof.pairedWebp, item.id);
    assert(
      proof.nativeWebpUnchanged && proof.suppliedPdfUnchanged && proof.pdfAlphaExactToPrintSource,
    );
    for (const kind of ['webp', 'pdf', 'thumb']) {
      const body = readFileSync(new URL('../public' + item[kind], import.meta.url));
      assert.equal(hash(body), item.files[kind].sha256);
      assert.equal(body.length, item.files[kind].bytes);
    }
    assert.deepEqual(validateEditorialReview(item, reviews.get(item.id)), {
      title: item.title,
      alt: item.alt,
      description: item.description,
    });
    assert.doesNotMatch(
      item.description,
      /The scene is an imagined illustration|AI.generated|FLUX|Download the transparent|classroom.*scrapbook/i,
    );
  }
});

test('exact Tesla models require current source evidence; generic robots and hands remain unbranded', () => {
  assert.equal(items.filter((x) => x.topic === 'cybercab').length, 100);
  assert.equal(items.filter((x) => x.topic === 'tesla-optimus').length, 97);
  assert.equal(items.filter((x) => x.topic === 'robot').length, 3);
  for (const item of items) {
    if (!item.productIdentity) {
      assert(!/\bTesla|\bOptimus|\bCybercab/i.test(item.title));
      continue;
    }
    const record = identities.artworks.find((x) => x.id === item.id);
    assert.deepEqual(
      reviewedProductMetadata(record, { sourceSha256: item.files.webp.sha256 }).productIdentity,
      item.productIdentity,
    );
    assert.equal(item.productIdentity.generation, null);
    if (item.productIdentity.kind === 'imagined-concept') {
      assert.match(item.title, /concept/i);
      assert.equal(item.productIdentity.model, null);
    }
    if (item.topic === 'tesla-optimus') {
      assert.equal(item.productIdentity.kind, 'product-family');
      assert.equal(item.productIdentity.model, null);
    }
  }
  const item = items.find((x) => x.productIdentity);
  assert.throws(
    () =>
      reviewedProductMetadata(
        identities.artworks.find((x) => x.id === item.id),
        { sourceSha256: 'f'.repeat(64) },
      ),
    /changed/,
  );
});

test('metadata and image replacement invalidate the source-bound review; missing reviews block the new batch', () => {
  const item = items[0],
    review = reviews.get(item.id);
  assert.throws(
    () => validateEditorialReview({ ...item, alt: item.alt + ' changed' }, review),
    /metadata changed/,
  );
  assert.throws(
    () =>
      validateEditorialReview(
        { ...item, files: { ...item.files, webp: { ...item.files.webp, sha256: '0'.repeat(64) } } },
        review,
      ),
    /image changed/,
  );
  assert.throws(
    () => reviewedImportCatalog([item], { schema: 1, artworks: [] }),
    /review required/i,
  );
  assert.throws(
    () => validateEditorialReview(item, { ...review, observations: [] }),
    /visible evidence/,
  );
});

test('PDF facts use the embedded print edition and its real density', () => {
  assert.equal(report.rows.filter((x) => x.suppliedPrintResizeSteps > 0).length, 36);
  for (const item of items) {
    const p = item.pdfPrint;
    assert(p.ppi >= 150 && p.ppi <= 600);
    assert(Math.abs(p.width / (p.pagePoints[0] / 72) - p.ppi) < 0.001);
    assert(Math.abs(p.height / (p.pagePoints[1] / 72) - p.ppi) < 0.01);
    assert(item.files.pdf.bytes <= 1_000_000);
  }
});

test('nine unique collection introductions bind to their current images and aliases have one canonical target', () => {
  const records = read('data/editorial/tesla-commerce-collections.json');
  assert.equal(Object.keys(records.topics).length, 9);
  assert.equal(new Set(Object.values(records.topics).map((x) => x.intro)).size, 9);
  for (const [topic, record] of Object.entries(records.topics))
    validateCollectionCopy(
      topic,
      items.filter((x) => x.topic === topic),
      record,
    );
  const redirects = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8');
  assert(redirects.includes('/clipart/tesla-cybercab/ /clipart/cybercab/ 301'));
  assert(redirects.includes('/clipart/optimus-robot/ /clipart/tesla-optimus/ 301'));
});
