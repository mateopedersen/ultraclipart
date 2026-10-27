import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mergeReviewedContent } from './merge-reviewed-content.mjs';
import { validatePublication } from './publication-policy.mjs';
import { mergeEditorialBatch } from './apply-editorial-review.mjs';
import { reviewedImportCatalog } from './reviewed-imports.mjs';
import { validateCollectionCopy } from './collection-editorial.mjs';

const root = path.resolve(import.meta.dirname, '..'),
  stage = path.join(root, 'work/imports/tesla-commerce-550');
const read = (p) => JSON.parse(fs.readFileSync(path.resolve(root, p)));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const save = (p, x) => {
  p = path.resolve(root, p);
  fs.writeFileSync(p + '.tmp', JSON.stringify(x, null, 2) + '\n');
  fs.renameSync(p + '.tmp', p);
};
const baseline = read('data/art.json');
const report = read(path.join(stage, 'review.next.json'));
const publicProof = read(path.join(stage, 'public-files-preflight.json'));
assert.equal(publicProof.status, 'PASS');
assert.equal(publicProof.count, 550);
const items = report.items;
assert.equal(report.count, 550);
assert.equal(items.length, 550);
assert.equal(report.baselineCatalogSha256, sha(fs.readFileSync(path.join(root, 'data/art.json'))));
assert.equal(
  report.identityRegistrySha256,
  sha(fs.readFileSync(path.join(root, 'data/identification/tesla-commerce-550.json'))),
);
const visual = read(path.join(stage, 'source-visual-review.json'));
assert.equal(visual.status, 'PASS');
assert.equal(
  report.sourceReviewSha256,
  sha(fs.readFileSync(path.join(stage, 'source-visual-review.json'))),
);
assert.equal(
  visual.perceptualReviewSha256,
  sha(fs.readFileSync(path.join(stage, 'perceptual-review.json'))),
);
assert.equal(
  visual.deltaReviewSha256,
  sha(fs.readFileSync(path.join(stage, 'concurrent-delta-review.json'))),
);
for (const review of Object.values(visual.topics))
  for (const sheet of [...review.sheets, ...review.pdfSheets])
    assert.equal(sheet.sha256, sha(fs.readFileSync(path.join(stage, sheet.path))));
assert.equal(report.exactDuplicateReview.status, 'PASS');
assert.equal(report.perceptualReview.status, 'PASS');
assert.equal(report.concurrentDeltaReview.status, 'PASS');
for (const wave of Array.from({ length: 11 }, (_, i) => i + 1)) {
  const batchPath = path.join(stage, `wave-${wave}.r2-batch.json`),
    batch = read(batchPath),
    journal = read(path.join(stage, `wave-${wave}.upload-journal.json`));
  assert.equal(batch.length, 150);
  assert.equal(journal.status, 'uploaded-and-byte-verified');
  assert.equal(journal.batchSha256, sha(fs.readFileSync(batchPath)));
  assert.equal(journal.verifiedArtworkIds.length, 50);
  assert.equal(journal.verifiedObjects.length, 150);
  for (const object of batch) {
    const body = fs.readFileSync(path.join(root, object.path));
    assert.equal(body.length, object.bytes);
    assert.equal(sha(body), object.sha256);
    assert(journal.verifiedObjects.some((x) => x.key === object.key && x.sha256 === object.sha256));
  }
}
for (const item of items) {
  const proof = report.rows.find((x) => x.id === item.id);
  assert.equal(item.files.webp.sha256, proof.hashes.webp);
  assert.equal(item.files.pdf.sha256, proof.hashes.pdf);
  assert(
    proof.nativeWebpUnchanged && proof.suppliedPdfUnchanged && proof.pdfAlphaExactToPrintSource,
  );
  assert.equal(proof.pairedWebp, item.id);
  assert.equal(proof.ppi, item.pdfPrint.ppi);
  assert(proof.ppi >= 150 && proof.ppi <= 600);
}
const merged = mergeReviewedContent({
  baseline,
  added: items,
  currentPublication: read('data/publication.json'),
  stagedPublication: read(path.join(stage, 'wave-11.publication.next.json')),
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
const prior = read('data/editorial/reviews.json');
const registry = mergeEditorialBatch(
  merged.art,
  {
    ...prior,
    artworks: Array.isArray(prior.artworks) ? prior.artworks : Object.values(prior.artworks),
  },
  read(path.join(stage, 'editorial-batch.json')),
);
reviewedImportCatalog(merged.art, registry);
const collectionReviews = read(path.join(stage, 'collection-editorial.next.json'));
for (const [topic, record] of Object.entries(collectionReviews.topics))
  validateCollectionCopy(
    topic,
    merged.art.filter((x) => x.topic === topic),
    record,
  );
for (const [p, x] of [
  ['data/art.json', merged.art],
  ['data/publication.json', merged.publication],
  ['data/extra-topics.json', merged.extra],
  ['data/collection-copy.json', merged.copy],
  ['data/topic-clusters.json', merged.clusters],
  ['data/editorial/reviews.json', registry],
  ['data/editorial/tesla-commerce-collections.json', collectionReviews],
])
  save(p, x);
save('data/tesla-commerce-collection-review.json', {
  ...report,
  status: 'CDN_VERIFIED_READY_FOR_DEPLOYMENT',
});
let redirects = fs.readFileSync(path.join(root, 'public/_redirects'), 'utf8');
for (const [from, to] of [
  ['tesla-cybercab', 'cybercab'],
  ['optimus-robot', 'tesla-optimus'],
]) {
  for (const suffix of ['', '/']) {
    const line = `/clipart/${from}${suffix} /clipart/${to}/ 301`;
    if (!redirects.includes(line)) redirects += '\n' + line + '\n';
  }
}
fs.writeFileSync(path.join(root, 'public/_redirects'), redirects);
execFileSync(process.execPath, [path.join(root, 'scripts/sync-production-queue.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
console.log(
  JSON.stringify({ status: 'PROMOTED_NOT_DEPLOYED', added: 550, total: merged.art.length }),
);
