import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mergeReviewedContent } from './merge-reviewed-content.mjs';
import { validatePublication } from './publication-policy.mjs';
const root = path.resolve(import.meta.dirname, '..');
const stage = path.join(root, 'work/imports/brain-50');
const collection = 'owner-brain-50-2026-10-26';
const read = (p) => JSON.parse(fs.readFileSync(path.resolve(root, p)));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const save = (p, x) => {
  p = path.resolve(root, p);
  fs.writeFileSync(p + '.tmp', JSON.stringify(x, null, 2) + '\n');
  fs.renameSync(p + '.tmp', p);
};
const baseline = read('data/art.json');
const items = read(path.join(stage, 'art.next.json')).filter(
  (x) => x.sourceCollection === collection,
);
const registry = read('data/identification/brain-50.json');
const visual = read(path.join(stage, 'source-visual-review.json'));
const exact = read(path.join(stage, 'duplicate-review.json'));
const perceptual = read(path.join(stage, 'perceptual-review.json'));
const preflight = read(path.join(stage, 'review/brain/preflight.json'));
const extraction = read(path.join(stage, 'extraction.json'));
const batchBytes = fs.readFileSync(path.join(stage, 'brain.r2-batch.json'));
const batch = JSON.parse(batchBytes);
const journal = read(path.join(stage, 'brain.upload-journal.json'));
const publication = read(path.join(stage, 'brain.publication.next.json'));
assert.equal(items.length, 50);
assert.equal(registry.artworks.length, 50);
assert.equal(exact.status, 'PASS');
assert.equal(exact.baselineCatalogSha256, sha(fs.readFileSync(path.join(root, 'data/art.json'))));
assert.equal(visual.status, 'PASS');
assert.equal(perceptual.status, 'PASS');
assert.equal(perceptual.decisions.length, perceptual.candidates.length);
assert.equal(
  visual.perceptualReviewSha256,
  sha(fs.readFileSync(path.join(stage, 'perceptual-review.json'))),
);
assert.equal(preflight.status, 'FORMAT_PASSED');
assert.equal(preflight.rows.length, 50);
assert(preflight.allPairsVisuallyMatched);
const dependencies = sha(
  Buffer.concat(
    ['scripts/verify-brain-collection.py', 'scripts/raster_source.py'].map((p) =>
      fs.readFileSync(path.join(root, p)),
    ),
  ),
);
for (const sheet of [...visual.topics.brain.sheets, ...visual.topics.brain.pdfSheets])
  assert.equal(sha(fs.readFileSync(path.join(stage, sheet.path))), sheet.sha256);
assert.equal(journal.status, 'uploaded-and-byte-verified');
assert.equal(journal.batchSha256, sha(batchBytes));
assert.equal(journal.verifiedArtworkIds.length, 50);
assert.equal(journal.verifiedObjects.length, 150);
for (const object of batch) {
  const body = fs.readFileSync(path.join(root, object.path));
  assert.equal(body.length, object.bytes);
  assert.equal(sha(body), object.sha256);
  assert(journal.verifiedObjects.some((x) => x.key === object.key && x.sha256 === object.sha256));
}
for (const item of items) {
  const record = registry.artworks.find((x) => x.id === item.id);
  const proof = preflight.rows.find((x) => x.id === item.id);
  assert.equal(record.status, 'PASS');
  assert(record.reviewedFromPixels);
  assert.equal(record.sourceSha256, item.files.webp.sha256);
  assert.equal(item.title, record.metadata.title);
  assert.equal(item.alt, record.metadata.alt);
  assert.equal(item.description, record.metadata.description);
  assert.equal(proof.dependencies, dependencies);
  assert.equal(proof.pairedWebp, item.id);
  assert(proof.pdfAlphaExactToPrintSource);
  assert.equal(proof.ppi, item.id === 'brain-and-hourglass-clipart' ? 425 : 750);
  assert.deepEqual(proof.pagePoints, [144, 144]);
  assert.equal(proof.hashes.webp, item.files.webp.sha256);
  assert.equal(proof.hashes.pdf, item.files.pdf.sha256);
  assert.equal(
    visual.authoredPdfProofs.find((x) => x.id === item.id).proofSha256,
    proof.proofSha256,
  );
  const archiveOriginal = extraction.files.find(
    (x) => x.path === 'brain-clipart/webp/' + item.id + '.webp',
  );
  assert.equal(archiveOriginal.sha256, item.files.webp.sha256);
}
const merged = mergeReviewedContent({
  baseline,
  added: items,
  currentPublication: read('data/publication.json'),
  stagedPublication: publication,
  baseTopics: read('data/topics.json').topics,
  currentExtra: read('data/extra-topics.json'),
  stagedExtra: read(path.join(stage, 'extra-topics.next.json')),
  currentCopy: read('data/collection-copy.json'),
  stagedCopy: read(path.join(stage, 'collection-copy.next.json')),
  currentClusters: read('data/topic-clusters.json'),
  stagedClusters: read(path.join(stage, 'topic-clusters.next.json')),
});
validatePublication(merged.publication, merged.art, (p) =>
  fs.readFileSync(path.join(root, 'public', p)),
);
for (const [p, x] of [
  ['data/art.json', merged.art],
  ['data/publication.json', merged.publication],
  ['data/extra-topics.json', merged.extra],
  ['data/collection-copy.json', merged.copy],
  ['data/topic-clusters.json', merged.clusters],
])
  save(p, x);
save('data/brain-collection-review.json', {
  collection,
  count: 50,
  reviewerType: 'AI_AGENT_NOT_HUMAN',
  physicalPrintProof: false,
  originalWebPsPreserved: 50,
  originalPdfsPreserved: 49,
  repairs: extraction.repairs,
  archives: extraction.archives,
  baselineCatalogSha256: exact.baselineCatalogSha256,
  sourceReview: visual.topics.brain,
  exactDuplicateReview: { ...exact, rows: undefined },
  perceptualReview: {
    status: perceptual.status,
    algorithm: perceptual.algorithm,
    decisions: perceptual.decisions,
  },
  identityRegistrySha256: sha(
    fs.readFileSync(path.join(root, 'data/identification/brain-50.json')),
  ),
  rows: preflight.rows.map((x) => ({
    id: x.id,
    hashes: x.hashes,
    dimensions: [x.width, x.height],
    pagePoints: x.pagePoints,
    ppi: x.ppi,
    printDimensions: x.printDimensions,
    pdfAlphaExact: x.pdfAlphaExact,
    pdfAlphaExactToPrintSource: x.pdfAlphaExactToPrintSource,
    proofSha256: x.proofSha256,
    pairedWebp: x.pairedWebp,
    meanRgbDifference: x.meanRgbDifference,
  })),
});
execFileSync(process.execPath, [path.join(root, 'scripts/sync-production-queue.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
console.log(
  JSON.stringify({
    status: 'ALL_532_READY_SOURCES_PROMOTED_NOT_DEPLOYED',
    brain: 50,
    totalNew: 532,
    total: merged.art.length,
    deferredDrawings: 134,
  }),
);
