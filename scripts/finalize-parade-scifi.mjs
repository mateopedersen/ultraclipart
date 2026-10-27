// Promote only the reviewed new sources; existing and superseded source IDs stay intact.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mergeReviewedContent } from './merge-reviewed-content.mjs';
import { validateIdentification } from './identification-review.mjs';
import { validateManifest, validatePublication } from './publication-policy.mjs';
const root = path.resolve(import.meta.dirname, '..'),
  stage = path.join(root, 'work/imports/parade-scifi-14'),
  collection = 'owner-parade-scifi-2026-10-26';
const read = (p) => JSON.parse(fs.readFileSync(path.resolve(root, p))),
  sha = (b) => createHash('sha256').update(b).digest('hex');
const save = (p, x) => {
  p = path.resolve(root, p);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p + '.tmp', JSON.stringify(x, null, 2) + '\n');
  fs.renameSync(p + '.tmp', p);
};
const registry = read('data/identification/parade-scifi.json'),
  records = new Map(registry.artworks.map((x) => [x.id, x])),
  baseline = read('data/art.json'),
  staged = read(path.join(stage, 'art.next.json')),
  added = staged.filter((x) => x.sourceCollection === collection),
  maps = read(path.join(stage, 'release-map.json')),
  extraction = read(path.join(stage, 'extraction.json')),
  visual = read(path.join(stage, 'source-visual-review.json')),
  exact = read(path.join(stage, 'duplicate-review.json')),
  similarity = read(path.join(stage, 'perceptual-review.json')),
  comparison = read(path.join(stage, 'source-comparison.json'));
assert.equal(added.length, 454);
assert.equal(records.size, 454);
assert.equal(maps.length, 11);
assert.equal(extraction.generated.length, 31);
assert.equal(extraction.repairs.length, 9);
assert.equal(extraction.compositionReplacements.length, 31);
assert.equal(visual.status, 'PASS');
assert.equal(exact.status, 'PASS');
assert.equal(exact.new, 454);
assert.equal(
  exact.baselineCatalogSha256,
  sha(fs.readFileSync(path.join(root, 'work/parade-production-baseline/art.json'))),
);
const concurrent = read(path.join(stage, 'concurrent-baseline-review.json'));
assert.equal(concurrent.status, 'PASS');
assert.equal(
  concurrent.currentBaselineSha256,
  sha(fs.readFileSync(path.join(root, 'data/art.json'))),
);
assert.deepEqual(baseline, read(path.join(stage, 'concurrent-main-baseline.json')));
assert.equal(concurrent.incomingOwnerSources, 482);
const concurrentSources = new Map(concurrent.ownerSourceChecksums.map((x) => [x.id, x.sha256]));
assert.equal(concurrentSources.size, 482);
assert.equal(similarity.status, 'PASS');
assert.equal(similarity.incoming, 454);
assert.equal(similarity.decisions.length, similarity.candidates.length);
assert.equal(
  visual.perceptualReviewSha256,
  sha(fs.readFileSync(path.join(stage, 'perceptual-review.json'))),
);
assert.equal(visual.authoredPdfProofs.length, 39);
assert.deepEqual(
  staged.filter((x) => x.sourceCollection !== collection),
  read('work/parade-production-baseline/art.json'),
  'Reviewed original baseline must be preserved exactly',
);
assert.equal(comparison.rows.length, 700);
assert.equal(comparison.rows.filter((x) => x.status === 'NEW').length, 454);
assert.equal(comparison.rows.filter((x) => x.status === 'IDENTICAL_PUBLISHED').length, 235);
assert.equal(comparison.rows.filter((x) => x.status === 'SAME_ID_CHANGED').length, 11);
for (const x of comparison.rows.filter((x) => x.status !== 'NEW')) {
  const prior = baseline.find((y) => y.id === x.existingId);
  assert(prior);
  assert.equal(prior.files.webp.sha256, x.existingSha256);
}
const dependencies = sha(
    Buffer.concat(
      ['scripts/verify-supplied-package.py', 'scripts/raster_source.py'].map((p) =>
        fs.readFileSync(path.join(root, p)),
      ),
    ),
  ),
  rows = [];
let final,
  objects = 0;
for (const m of maps) {
  const batchBytes = fs.readFileSync(path.join(stage, m.topic + '.r2-batch.json')),
    batch = JSON.parse(batchBytes),
    journal = read(path.join(stage, m.topic + '.upload-journal.json')),
    manifest = read(path.join(stage, m.topic + '.publication.next.json')),
    proof = read(path.join(stage, 'review', m.topic, 'preflight.json')),
    newRows = proof.rows.filter((x) => records.has(x.id));
  assert.equal(journal.status, 'uploaded-and-byte-verified');
  assert.equal(journal.batchSha256, sha(batchBytes));
  assert.equal(batch.length, newRows.length * 3);
  assert.equal(journal.verifiedObjects.length, batch.length);
  assert.equal(journal.verifiedArtworkIds.length, newRows.length);
  validateManifest(manifest);
  assert.equal(proof.status, 'FORMAT_PASSED');
  assert.equal(proof.rows.length, 50);
  assert.equal(visual.topics[m.topic].status, 'PASS');
  for (const b of batch) {
    const bytes = fs.readFileSync(path.join(root, b.path));
    assert.equal(bytes.length, b.bytes);
    assert.equal(sha(bytes), b.sha256);
    const checked = journal.verifiedObjects.find((x) => x.key === b.key && x.bucket === b.bucket);
    assert.equal(checked?.sha256, b.sha256);
  }
  for (const checked of newRows) {
    const a = added.find((x) => x.id === checked.id),
      r = records.get(a.id),
      source = fs.readFileSync(path.join(root, 'public', a.webp));
    assert.equal(checked.dependencies, dependencies);
    assert.equal(sha(source), r.sourceSha256);
    assert.equal(concurrentSources.get(a.id), r.sourceSha256);
    assert.equal(checked.hashes.webp, a.files.webp.sha256);
    assert.equal(checked.hashes.pdf, a.files.pdf.sha256);
    assert.equal(checked.ppi, 300);
    assert(checked.pdfAlphaExactToPrintSource);
    assert(checked.pdfBytes <= 1_000_000);
    assert.equal(checked.pairedWebp, a.id);
    const authored = visual.authoredPdfProofs.find((x) => x.id === a.id);
    if (authored) assert.equal(authored.proofSha256, checked.proofSha256);
    if (r.level !== 'generic-subject')
      validateIdentification({ artwork: a, sourceBytes: source, record: r });
    rows.push({
      id: a.id,
      archiveTopic: m.topic,
      hashes: checked.hashes,
      dimensions: [checked.width, checked.height],
      printDimensions: checked.printDimensions,
      ppi: checked.ppi,
      pagePoints: checked.pagePoints,
      pdfAlphaExact: checked.pdfAlphaExact,
      pdfAlphaExactToPrintSource: checked.pdfAlphaExactToPrintSource,
      printSourceSha256: checked.printSourceSha256,
      proofSha256: checked.proofSha256,
      meanRgbDifference: checked.meanRgbDifference,
      pairedWebp: checked.pairedWebp,
    });
  }
  objects += batch.length;
  final = manifest;
}
assert.equal(objects, 1362);
assert.equal(rows.length, 454);
assert.equal(new Set(staged.map((x) => x.id)).size, staged.length);
const merged = mergeReviewedContent({
  baseline,
  added,
  currentPublication: read('data/publication.json'),
  stagedPublication: final,
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
save('data/parade-scifi-concurrent-review.json', concurrent);
save('data/parade-scifi-review.json', {
  collection,
  count: 454,
  concurrentAcceptedAdditionsPreserved: concurrent.concurrentAcceptedAdditions,
  suppliedPairs: 700,
  alreadyPublishedIdentical: 235,
  olderSuppliedSourcesNotReverted: 11,
  suppliedNewRetained: 423,
  replacedCompositions: 31,
  malformedInputPdfs: 9,
  repairedOriginalPdfsRetained: 8,
  repairedPdfSupersededByComposition: 1,
  reviewerType: 'AI_AGENT_NOT_HUMAN',
  physicalPrintProof: false,
  archives: extraction.archives,
  repairs: extraction.repairs,
  drawings: extraction.generated,
  authoredPdfProofs: visual.authoredPdfProofs,
  identityRegistrySha256: sha(
    fs.readFileSync(path.join(root, 'data/identification/parade-scifi.json')),
  ),
  exactDuplicateReview: { ...exact, rows: undefined },
  perceptualReview: {
    algorithm: similarity.algorithm,
    baseline: similarity.baseline,
    incoming: similarity.incoming,
    status: similarity.status,
    candidates: similarity.decisions,
  },
  sourceReview: visual.topics,
  preservedExisting: visual.changedExistingIds,
  rows,
});
save('design-assets/parade-scifi/prompt-set.json', {
  collection,
  generator: 'built-in image_gen',
  replacements: 31,
  nativeResolutionPreserved: true,
  artworks: extraction.generated.map(
    ({
      id,
      topic,
      prompt,
      sourcePng,
      sourcePngSha256,
      dimensions,
      printDimensions,
      printSourceSha256,
      printResampling,
      files,
      framingEdit,
    }) => ({
      id,
      topic,
      prompt,
      sourcePng: 'work/imports/parade-scifi-14/' + sourcePng,
      sourcePngSha256,
      dimensions,
      printDimensions,
      printSourceSha256,
      printResampling,
      files,
      ...(framingEdit ? { framingEdit } : {}),
    }),
  ),
});
execFileSync(process.execPath, [path.join(root, 'scripts/sync-production-queue.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
console.log(
  JSON.stringify({
    status: 'REVIEWED_LOCAL_RELEASE_PROMOTED_NOT_DEPLOYED',
    baseline: baseline.length,
    added: 454,
    total: merged.art.length,
    newTopics: 9,
    objects,
  }),
);
