import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mergeReviewedContent } from './merge-reviewed-content.mjs';
import { validatePublication } from './publication-policy.mjs';
const root = path.resolve(import.meta.dirname, '..');
const stage = path.join(root, 'work/imports/donald-trump-100');
const collection = 'owner-donald-trump-100-2026-10-26';
const read = (p) => JSON.parse(fs.readFileSync(path.resolve(root, p)));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const save = (p, x) => {
  p = path.resolve(root, p);
  fs.writeFileSync(p + '.tmp', JSON.stringify(x, null, 2) + '\n');
  fs.renameSync(p + '.tmp', p);
};
const baseline = read('data/art.json');
const localReview = read('data/donald-trump-collection-review.json');
assert.equal(localReview.count, 100);
assert.equal(
  localReview.identityRegistrySha256,
  sha(fs.readFileSync(path.join(root, 'data/identification/donald-trump-100.json'))),
);
const items = read(path.join(stage, 'art.next.json')).filter(
  (x) => x.sourceCollection === collection,
);
const registry = read('data/identification/donald-trump-100.json');
const visual = read(path.join(stage, 'source-visual-review.json'));
const exact = read(path.join(stage, 'duplicate-review.json'));
const perceptual = read(path.join(stage, 'perceptual-review.json'));
const preflight = read(path.join(stage, 'review/donald-trump/preflight.json'));
const extraction = read(path.join(stage, 'extraction.json'));
const batch = read(path.join(stage, 'donald-trump.r2-batch.json'));
const publication = read(path.join(stage, 'wave-2.publication.next.json'));
assert.equal(items.length, 100);
assert.equal(registry.artworks.length, 100);
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
assert.equal(preflight.rows.length, 100);
assert(preflight.allPairsVisuallyMatched);
const dependencies = sha(
  Buffer.concat(
    ['scripts/verify-trump-collection.py', 'scripts/raster_source.py'].map((p) =>
      fs.readFileSync(path.join(root, p)),
    ),
  ),
);
for (const sheet of [
  ...visual.topics['donald-trump'].sheets,
  ...visual.topics['donald-trump'].pdfSheets,
])
  assert.equal(sha(fs.readFileSync(path.join(stage, sheet.path))), sheet.sha256);
for (const wave of [1, 2]) {
  const waveBatch = read(path.join(stage, `wave-${wave}.r2-batch.json`));
  const waveJournal = read(path.join(stage, `wave-${wave}.upload-journal.json`));
  assert.equal(waveJournal.status, 'uploaded-and-byte-verified');
  assert.equal(
    waveJournal.batchSha256,
    sha(fs.readFileSync(path.join(stage, `wave-${wave}.r2-batch.json`))),
  );
  assert.equal(waveJournal.verifiedArtworkIds.length, 50);
  assert.equal(waveJournal.verifiedObjects.length, 150);
  for (const object of waveBatch) {
    const body = fs.readFileSync(path.join(root, object.path));
    assert.equal(body.length, object.bytes);
    assert.equal(sha(body), object.sha256);
    assert(
      waveJournal.verifiedObjects.some((x) => x.key === object.key && x.sha256 === object.sha256),
    );
  }
}
assert.equal(batch.length, 300);
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
  assert.equal(proof.ppi, 300);
  assert(proof.nativeWebpUnchanged && proof.suppliedPdfUnchanged);
  assert.equal(proof.hashes.webp, item.files.webp.sha256);
  assert.equal(proof.hashes.pdf, item.files.pdf.sha256);
  assert.equal(
    visual.authoredPdfProofs.find((x) => x.id === item.id).proofSha256,
    proof.proofSha256,
  );
  const archiveOriginal = extraction.files.find(
    (x) => x.path === 'donald-trump-clipart/webp/' + item.id + '.webp',
  );
  assert.equal(archiveOriginal.sha256, item.files.webp.sha256);
  assert.equal(
    extraction.files.find((x) => x.path === 'donald-trump-clipart/pdf/' + item.id + '.pdf').sha256,
    item.files.pdf.sha256,
  );
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
save('data/donald-trump-collection-review.json', {
  ...localReview,
  status: 'CDN_VERIFIED_READY_FOR_DEPLOYMENT',
});
execFileSync(process.execPath, [path.join(root, 'scripts/sync-production-queue.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
console.log(
  JSON.stringify({
    status: 'ALL_100_TRUMP_SOURCES_PROMOTED_NOT_DEPLOYED',
    totalNew: 100,
    total: merged.art.length,
    deferredDrawings: 134,
  }),
);
