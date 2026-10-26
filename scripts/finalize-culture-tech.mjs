// Promote only this reviewed, fully byte-verified package. This does not deploy.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { validateIdentification } from './identification-review.mjs';
import { validateManifest, validatePublication } from './publication-policy.mjs';

const root = resolve(import.meta.dirname, '..');
const stage = join(root, 'work/imports/culture-tech-25');
const collection = 'owner-culture-tech-2026-10-26';
const read = (p) => JSON.parse(readFileSync(resolve(root, p)));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const save = (p, value) => {
  const path = resolve(root, p);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path + '.tmp', JSON.stringify(value, null, 2) + '\n');
  renameSync(path + '.tmp', path);
};
const mapping = read(join(stage, 'topic-map.json'));
const registry = read('data/identification/culture-tech.json');
const records = new Map(registry.artworks.map((x) => [x.id, x]));
const extraction = read(join(stage, 'extraction.json'));
const visual = read(join(stage, 'source-visual-review.json'));
const duplicates = read(join(stage, 'duplicate-review.json'));
const similarity = read(join(stage, 'perceptual-review.json'));
assert.equal(mapping.length, 25);
assert.equal(records.size, 1250);
assert.equal(extraction.generated.length, 32);
assert.equal(extraction.repairs.length, 8);
assert.equal(extraction.compositionReplacements.length, 14);
assert.equal(visual.status, 'PASS');
assert.equal(duplicates.status, 'PASS');
assert.equal(duplicates.new, 1250);
assert.equal(similarity.status, 'PASS');
assert.equal(similarity.incoming, 1250);
assert.equal(similarity.candidates.length, similarity.decisions.length);
assert.equal(
  visual.perceptualReviewSha256,
  sha(readFileSync(join(stage, 'perceptual-review.json'))),
);
assert.equal(visual.authoredPdfProofs.length, 40);
const correctionIds = read(join(stage, 'composition-correction-ids.json')).ids;
const correctionBatchBytes = readFileSync(join(stage, 'composition-corrections.r2-batch.json'));
const correctionBatch = JSON.parse(correctionBatchBytes);
const correctionJournal = read(join(stage, 'composition-corrections.upload-journal.json'));
assert.equal(correctionIds.length, 10);
assert.equal(correctionBatch.length, 30);
assert.equal(correctionJournal.status, 'uploaded-and-byte-verified');
assert.equal(correctionJournal.batchSha256, sha(correctionBatchBytes));
assert.equal(correctionJournal.verifiedArtworkIds.length, 10);
assert.equal(correctionJournal.verifiedObjects.length, 30);
for (const object of correctionBatch) {
  assert(correctionIds.includes(object.assetId));
  const bytes = readFileSync(join(root, object.path));
  assert.equal(bytes.length, object.bytes);
  assert.equal(sha(bytes), object.sha256);
}
const baseline = read('data/art.json').filter((x) => x.sourceCollection !== collection);
const staged = read(join(stage, 'art.next.json')).filter((x) => x.sourceCollection === collection);
assert.equal(staged.length, 1250);
assert.equal(duplicates.baselineCatalogSha256, sha(readFileSync(join(root, 'data/art.json'))));
const rows = [];
const verifierDependencies = sha(
  Buffer.concat([
    readFileSync(join(root, 'scripts/verify-supplied-package.py')),
    readFileSync(join(root, 'scripts/raster_source.py')),
  ]),
);
for (const m of mapping) {
  assert.equal(visual.topics[m.topic].status, 'PASS');
  const batchBytes = readFileSync(join(stage, m.topic + '.r2-batch.json'));
  const batch = JSON.parse(batchBytes);
  const journal = read(join(stage, m.topic + '.upload-journal.json'));
  assert.equal(journal.status, 'uploaded-and-byte-verified');
  assert.equal(journal.batchSha256, sha(batchBytes));
  assert.equal(journal.verifiedObjects.length, 150);
  assert.equal(journal.verifiedArtworkIds.length, 50);
  assert.equal(batch.length, 150);
  validateManifest(read(join(stage, m.topic + '.publication.next.json')));
  const proof = read(join(stage, 'review', m.topic, 'preflight.json'));
  assert.equal(proof.status, 'FORMAT_PASSED');
  assert.equal(proof.rows.length, 50);
  for (const checked of proof.rows) {
    assert.equal(checked.dependencies, verifierDependencies, 'Stale format verifier');
    const artwork = staged.find((x) => x.id === checked.id);
    const record = records.get(checked.id);
    const sourceBytes = readFileSync(join(root, 'public', artwork.webp));
    assert.equal(sha(sourceBytes), record.sourceSha256);
    assert.equal(checked.hashes.webp, record.sourceSha256);
    assert.equal(checked.hashes.pdf, artwork.files.pdf.sha256);
    assert.equal(checked.ppi, 300);
    assert(checked.pdfAlphaExactToPrintSource);
    const authored = visual.authoredPdfProofs.find((x) => x.id === checked.id);
    if (authored) assert.equal(authored.proofSha256, checked.proofSha256);
    Object.assign(artwork, record.metadata, {
      style: record.style,
      visualStyle: record.visualStyle,
      discovery: record.discovery,
    });
    if (!['generic-subject', 'political-symbol'].includes(record.level)) {
      const identity = validateIdentification({ artwork, sourceBytes, record });
      artwork.productIdentity = identity.productIdentity;
    } else {
      delete artwork.productIdentity;
    }
    const generated = extraction.generated.find((x) => x.id === artwork.id);
    artwork.provenance = generated
      ? generated.replacesSuppliedSource
        ? 'Replacement composition drawn after visual review; original artwork ID retained.'
        : 'Completion drawing produced for this reviewed collection.'
      : extraction.repairs.some((x) => x.id === artwork.id)
        ? 'Owner-supplied WebP retained; matching PDF rebuilt after an invalid image-stream encoding was found.'
        : 'Owner-supplied collection; original PDF and WebP bytes preserved.';
    rows.push({
      id: artwork.id,
      archiveTopic: m.topic,
      topic: artwork.topic,
      hashes: checked.hashes,
      pdfBytes: checked.pdfBytes,
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
}
const next = [...baseline, ...staged];
assert.equal(new Set(next.map((x) => x.id)).size, next.length);
// The initial 25-wave upload is retained as audit history. Ten late generic
// character replacements supersede its old representations before publication.
const final = read(join(stage, 'composition-corrections.publication.json'));
const published = read('data/publication.json');
const union = new Map(published.files.map((x) => [x.assetId + ':' + x.kind, x]));
for (const x of final.files) {
  // Concurrent releases own their baseline assets. Promote only this batch.
  if (!records.has(x.assetId)) continue;
  const key = x.assetId + ':' + x.kind;
  if (union.has(key)) assert.deepEqual(union.get(key), x);
  union.set(key, x);
}
final.files = [...union.values()];
final.bytes = final.files.reduce((sum, x) => sum + x.bytes, 0);
validatePublication(final, next, (path) => readFileSync(join(root, 'public', path)));
const contexts = read('scripts/culture-tech-contexts.json');
const extra = read('data/extra-topics.json');
const allTopics = [...read('data/topics.json').topics, ...extra];
let nextTopicId = Math.max(...allTopics.map((x) => x.id)) + 1;
for (const topic of read(join(stage, 'extra-topics.next.json'))) {
  if (!contexts[topic.slug]) continue;
  const prior = extra.find((x) => x.slug === topic.slug);
  const row = { ...topic, cluster: contexts[topic.slug].cluster };
  if (prior) Object.assign(prior, row, { id: prior.id });
  else extra.push({ ...row, id: nextTopicId++ });
}
const copy = {
  ...read('data/collection-copy.json'),
  ...read(join(stage, 'collection-copy.next.json')),
};
// Preserve newer baseline copy while promoting just this package's topics.
const currentCopy = read('data/collection-copy.json');
for (const key of Object.keys(currentCopy)) if (!contexts[key]) copy[key] = currentCopy[key];
save('data/art.json', next);
save('data/publication.json', final);
save('data/extra-topics.json', extra);
save('data/collection-copy.json', copy);
const clusters = read('data/topic-clusters.json');
const stagedClusters = read(join(stage, 'topic-clusters.next.json'));
for (const topic of Object.keys(contexts)) clusters[topic] = stagedClusters[topic] ?? [];
save('data/topic-clusters.json', clusters);
save('data/culture-tech-review.json', {
  collection,
  count: 1250,
  originalSuppliedDesigns: 1232,
  suppliedRetained: 1218,
  completedMissing: 18,
  replacedCompositions: 14,
  repairedPdfs: 8,
  reviewerType: 'AI_AGENT_NOT_HUMAN',
  physicalPrintProof: false,
  archives: extraction.archives,
  repairs: extraction.repairs,
  drawings: extraction.generated,
  authoredPdfProofs: visual.authoredPdfProofs,
  compositionCorrectionPublication: {
    artworkIds: correctionIds,
    batchSha256: sha(correctionBatchBytes),
    completedAt: correctionJournal.completedAt,
    objects: correctionJournal.verifiedObjects,
    initialRepresentationsSupersededBeforePublication: true,
  },
  genericCharacterDesignReviews: registry.artworks
    .filter((x) => x.genericCharacterDesignReview)
    .map((x) => ({ id: x.id, ...x.genericCharacterDesignReview })),
  identityRegistrySha256: sha(readFileSync(join(root, 'data/identification/culture-tech.json'))),
  exactDuplicateReview: { ...duplicates, rows: undefined },
  perceptualReview: {
    algorithm: similarity.algorithm,
    baseline: similarity.baseline,
    incoming: similarity.incoming,
    status: similarity.status,
    candidates: similarity.decisions,
  },
  sourceReview: visual.topics,
  rows,
});
save('design-assets/culture-tech/prompt-set.json', {
  collection,
  generator: 'built-in image_gen',
  completedMissing: 18,
  replacements: 14,
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
      replacesSuppliedSource,
    }) => ({
      id,
      topic,
      prompt,
      sourcePng: 'work/imports/culture-tech-25/' + sourcePng,
      sourcePngSha256,
      dimensions,
      printDimensions,
      printSourceSha256,
      printResampling,
      files,
      replacesSuppliedSource: !!replacesSuppliedSource,
    }),
  ),
});
const aliases = {
  'disney-hexed': 'hexed',
  sonic: 'sonic-the-hedgehog',
  'angry-birds-movie': 'angry-birds',
};
const redirectPath = join(root, 'public/_redirects');
let redirects = readFileSync(redirectPath, 'utf8');
for (const [from, to] of Object.entries(aliases))
  for (const slash of ['', '/']) {
    const line = `/clipart/${from}${slash} /clipart/${to}/ 301`;
    if (!redirects.split('\n').includes(line)) redirects += '\n' + line;
  }
writeFileSync(redirectPath, redirects.trimEnd() + '\n');
execFileSync(process.execPath, [join(root, 'scripts/sync-production-queue.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
console.log(
  JSON.stringify({
    status: 'LOCAL_RELEASE_PROMOTED_NOT_DEPLOYED',
    baseline: baseline.length,
    added: staged.length,
    total: next.length,
    representations: final.files.length,
  }),
);
