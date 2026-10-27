import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateEditorialReview, verifyEditorialCatalog } from './artwork-editorial.mjs';
import legacyBaseline from '../data/editorial/legacy-baseline.json' with { type: 'json' };

// Reuse the coordinated review validator without importing the other checkout's
// unfinished catalog migration or asserting that unseen legacy images were reviewed.
/** @template T @param {T[]} catalog @param {any} registry @returns {T[]} */
export function reviewedImportCatalog(catalog, registry) {
  if (registry.schema !== 1 || !Array.isArray(registry.artworks))
    throw Error('Invalid editorial registry');
  // The unchanged finite ledger covers only the pre-existing 13,004 sources.
  // Every later or replaced source/metadata needs a real review, in every topic.
  // Do not apply the other checkout's pending legacy text migration here.
  verifyEditorialCatalog(catalog, legacyBaseline, registry);
  const reviews = new Map();
  for (const review of registry.artworks) {
    if (reviews.has(review.id)) throw Error('Duplicate editorial review: ' + review.id);
    reviews.set(review.id, review);
  }
  const ids = new Set(catalog.map((x) => x.id));
  for (const id of reviews.keys()) if (!ids.has(id)) throw Error('Orphan editorial review: ' + id);
  return catalog.map((item) => {
    const review = reviews.get(item.id);
    if (!review && item.sourceCollection === 'owner-tesla-commerce-550-2026-10-27')
      throw Error('Missing source-bound incoming image review: ' + item.id);
    return review ? { ...item, ...validateEditorialReview(item, review) } : item;
  });
}
// Build-time metadata and audits must use the same reviewed copy as page rendering.
export function readReviewedImportCatalog(root) {
  const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  return reviewedImportCatalog(read('data/art.json'), read('data/editorial/reviews.json'));
}
export function reviewImportAudit(root) {
  const read = (p) => JSON.parse(readFileSync(resolve(root, p)));
  const catalog = read('data/art.json'),
    registry = read('data/editorial/reviews.json');
  reviewedImportCatalog(catalog, registry);
  return {
    total: catalog.length,
    sourceBoundReviews: registry.artworks.length,
    outsideSharedReviewRegistry: catalog.length - registry.artworks.length,
    outsideRegistryStatus:
      'Not re-audited in this release; other source-bound import evidence remains separate.',
    legacyMigrationImported: false,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(JSON.stringify(reviewImportAudit(resolve(import.meta.dirname, '..')), null, 2));
