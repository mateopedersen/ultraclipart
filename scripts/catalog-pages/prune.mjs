import { createHash } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const validId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Remove only pages that were uploaded to private R2 and read back byte-for-byte
 * in this exact build. Every member of the collection needs both routes. */
export function pruneVerifiedCatalogPages(dist, art, manifestPath, collection, revision) {
  if (!/^[a-f0-9]{40}$/.test(revision)) throw Error('Invalid catalog release revision');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const items = art.filter((item) => item.sourceCollection === collection);
  if (
    manifest.schema !== 1 ||
    manifest.status !== 'verified' ||
    manifest.collection !== collection ||
    manifest.revision !== revision ||
    manifest.bucket !== 'ultraclipart-pages' ||
    manifest.count !== items.length ||
    manifest.pageCount !== items.length * 2 ||
    !Array.isArray(manifest.pages) ||
    manifest.pages.length !== manifest.pageCount ||
    !items.length
  )
    throw Error('Catalog page publication manifest is incomplete');

  const ids = new Set(items.map((item) => item.id));
  const seen = new Set();
  const files = [];
  for (const entry of manifest.pages) {
    if (!ids.has(entry.id) || !validId.test(entry.id) || !['art', 'edit'].includes(entry.kind))
      throw Error('Catalog page publication contains an unexpected route');
    const identity = `${entry.kind}/${entry.id}`;
    if (seen.has(identity) || entry.key !== `html/${revision}/${identity}/index.html`)
      throw Error('Catalog page publication route is duplicated or malformed');
    seen.add(identity);
    const path = join(dist, entry.kind, entry.id, 'index.html');
    const bytes = readFileSync(path);
    if (bytes.length !== entry.bytes || sha(bytes) !== entry.sha256)
      throw Error(`Catalog HTML differs from verified R2 object: ${identity}`);
    files.push(path);
  }
  if (seen.size !== items.length * 2) throw Error('Catalog page publication lacks a route');
  // No output is removed until the entire collection has passed verification.
  for (const path of files) rmSync(path);
  return files.length;
}
