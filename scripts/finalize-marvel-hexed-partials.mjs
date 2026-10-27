import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mergeReviewedContent } from './merge-reviewed-content.mjs';
import { validateIdentification } from './identification-review.mjs';
import { validatePublication } from './publication-policy.mjs';
const root = path.resolve(import.meta.dirname, '..'),
  stage = path.join(root, 'work/imports/marvel-hexed-4'),
  collection = 'owner-marvel-hexed-partials-2026-10-26',
  read = (p) => JSON.parse(fs.readFileSync(path.resolve(root, p))),
  sha = (b) => createHash('sha256').update(b).digest('hex'),
  save = (p, x) => {
    p = path.resolve(root, p);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p + '.tmp', JSON.stringify(x, null, 2) + '\n');
    fs.renameSync(p + '.tmp', p);
  };
const baseline = read('data/art.json'),
  staged = read(path.join(stage, 'art.next.json')),
  items = staged.filter((x) => x.sourceCollection === collection),
  registry = read('data/identification/marvel-hexed-partials.json'),
  records = new Map(registry.artworks.map((x) => [x.id, x])),
  visual = read(path.join(stage, 'source-visual-review.json')),
  exact = read(path.join(stage, 'duplicate-review.json')),
  similarity = read(path.join(stage, 'perceptual-review.json')),
  batchBytes = fs.readFileSync(path.join(stage, 'all.r2-batch.json')),
  batch = JSON.parse(batchBytes),
  journal = read(path.join(stage, 'all.upload-journal.json')),
  manifest = read(path.join(stage, 'all.publication.next.json')),
  extraction = read(path.join(stage, 'extraction.json'));
const baselineById = new Map(baseline.map((x) => [x.id, x]));
for (const x of staged.filter((x) => x.sourceCollection !== collection))
  assert.deepEqual(baselineById.get(x.id), x, 'Previously reviewed source changed');
const concurrent = read('data/parade-scifi-concurrent-review.json');
assert.equal(concurrent.status, 'PASS');
const concurrentSources = new Map(concurrent.ownerSourceChecksums.map((x) => [x.id, x.sha256]));
assert.deepEqual(
  baseline.filter((x) => x.sourceCollection !== 'owner-parade-scifi-2026-10-26'),
  read('work/imports/parade-scifi-14/concurrent-main-baseline.json'),
);
assert.equal(items.length, 28);
assert.equal(records.size, 28);
assert.equal(visual.status, 'PASS');
assert.equal(exact.status, 'PASS');
assert.equal(
  exact.baselineCatalogSha256,
  sha(fs.readFileSync(path.join(root, 'work/imports/parade-scifi-14/art.next.json'))),
);
assert.equal(similarity.status, 'PASS');
assert.equal(similarity.decisions.length, similarity.candidates.length);
assert.equal(
  visual.perceptualReviewSha256,
  sha(fs.readFileSync(path.join(stage, 'perceptual-review.json'))),
);
assert.equal(journal.status, 'uploaded-and-byte-verified');
assert.equal(journal.batchSha256, sha(batchBytes));
assert.equal(batch.length, 84);
assert.equal(journal.verifiedObjects.length, 84);
assert.equal(journal.verifiedArtworkIds.length, 28);
const dependencies = sha(
    Buffer.concat(
      ['scripts/verify-supplied-package.py', 'scripts/raster_source.py'].map((p) =>
        fs.readFileSync(path.join(root, p)),
      ),
    ),
  ),
  proofs = [];
for (const x of batch) {
  const bytes = fs.readFileSync(path.join(root, x.path));
  assert.equal(sha(bytes), x.sha256);
  assert.equal(bytes.length, x.bytes);
  assert(journal.verifiedObjects.some((y) => y.key === x.key && y.sha256 === x.sha256));
}
for (const m of read(path.join(stage, 'topic-map.json'))) {
  const report = read(path.join(stage, 'review', m.topic, 'preflight.json'));
  assert.equal(report.status, 'FORMAT_PASSED');
  assert.equal(report.rows.length, m.pairs);
  for (const p of report.rows.filter((p) => records.has(p.id))) {
    const a = items.find((x) => x.id === p.id),
      record = records.get(p.id),
      source = fs.readFileSync(path.join(root, 'public', a.webp));
    assert.equal(p.dependencies, dependencies);
    assert.equal(p.ppi, 300);
    assert(p.pdfAlphaExactToPrintSource);
    assert.equal(p.pairedWebp, p.id);
    assert.equal(p.hashes.pdf, a.files.pdf.sha256);
    assert.equal(p.hashes.webp, a.files.webp.sha256);
    assert.equal(concurrentSources.get(a.id), record.sourceSha256);
    assert.equal(visual.authoredPdfProofs.find((x) => x.id === p.id)?.proofSha256, p.proofSha256);
    validateIdentification({ artwork: a, sourceBytes: source, record });
    proofs.push({
      id: p.id,
      hashes: p.hashes,
      ppi: p.ppi,
      pdfAlphaExact: p.pdfAlphaExact,
      pdfAlphaExactToPrintSource: p.pdfAlphaExactToPrintSource,
      proofSha256: p.proofSha256,
      pairedWebp: p.pairedWebp,
      pagePoints: p.pagePoints,
    });
  }
}
assert.equal(proofs.length, 28);
const merged = mergeReviewedContent({
  baseline,
  added: items,
  currentPublication: read('data/publication.json'),
  stagedPublication: manifest,
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
save('data/art.json', merged.art);
save('data/publication.json', merged.publication);
save('data/extra-topics.json', merged.extra);
save('data/collection-copy.json', merged.copy);
save('data/topic-clusters.json', merged.clusters);
save('data/marvel-hexed-partials-review.json', {
  collection,
  count: 28,
  concurrentAcceptedAdditionsPreserved: concurrent.concurrentAcceptedAdditions,
  suppliedPairs: 64,
  alreadyPublishedIdentical: 36,
  completedDrawingsGenerated: 0,
  completionDeferredByOwner: true,
  pendingDesigns: { avengers: 39, 'avengers-doomsday': 48, 'doctor-doom': 47 },
  pendingTotal: 134,
  completeFiftyDesignSets: false,
  reviewerType: 'AI_AGENT_NOT_HUMAN',
  physicalPrintProof: false,
  archives: extraction.archives,
  authoredPdfProofs: visual.authoredPdfProofs,
  sourceReview: visual.topics,
  exactDuplicateReview: { ...exact, rows: undefined },
  perceptualReview: {
    status: similarity.status,
    algorithm: similarity.algorithm,
    candidates: similarity.decisions,
  },
  identityRegistrySha256: sha(
    fs.readFileSync(path.join(root, 'data/identification/marvel-hexed-partials.json')),
  ),
  rows: proofs,
});
execFileSync(process.execPath, [path.join(root, 'scripts/sync-production-queue.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
console.log(
  JSON.stringify({
    status: 'ALL_READY_CONTENT_PROMOTED_NOT_DEPLOYED',
    newInThisPartialBatch: 28,
    totalNewAcrossBothBatches: 482,
    total: merged.art.length,
    deferredDrawings: 134,
  }),
);
