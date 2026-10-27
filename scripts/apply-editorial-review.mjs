import { readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateEditorialReview } from './artwork-editorial.mjs';

/** Validate the ENTIRE batch before returning a replacement registry. No partial imports. */
export function mergeEditorialBatch(catalog, registry, batch) {
  if (registry?.schema !== 1 || !Array.isArray(registry.artworks))
    throw new Error('Unsupported editorial registry');
  if (batch?.schema !== 1 || !Array.isArray(batch.artworks) || !batch.artworks.length)
    throw new Error('An explicit, nonempty review batch is required');
  const items = new Map(catalog.map((item) => [item.id, item]));
  const seen = new Set();
  const records = batch.artworks.map((input) => {
    if (seen.has(input.id)) throw new Error(`Duplicate batch ID: ${input.id}`);
    seen.add(input.id);
    const item = items.get(input.id);
    if (!item) throw new Error(`Unknown artwork: ${input.id}`);
    validateEditorialReview(item, input);
    // Preparation-only paths and numbering never become public catalog data.
    const { number, originalPath, ...record } = input;
    return record;
  });
  const merged = new Map(registry.artworks.map((record) => [record.id, record]));
  if (merged.size !== registry.artworks.length) throw new Error('Duplicate registry ID');
  for (const record of records) merged.set(record.id, record);
  return { ...registry, artworks: [...merged.values()] };
}

const fingerprint = (text) => createHash('sha256').update(text).digest('hex');

export function applyEditorialBatch(root, batchPath, { write = false } = {}) {
  const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  const target = resolve(root, 'data/editorial/reviews.json');
  const original = readFileSync(target, 'utf8');
  const registry = JSON.parse(original);
  const batch = read(batchPath);
  const merged = mergeEditorialBatch(read('data/art.json'), registry, batch);
  if (write) {
    // Do not silently overwrite a review added by another active checkout process.
    if (fingerprint(readFileSync(target, 'utf8')) !== fingerprint(original))
      throw new Error('The registry changed during validation. Re-run against the latest file.');
    const temporary = resolve(dirname(target), `.review-${randomUUID()}.tmp`);
    try {
      writeFileSync(temporary, JSON.stringify(merged, null, 2) + '\n', { flag: 'wx' });
      renameSync(temporary, target);
    } catch (error) {
      try {
        unlinkSync(temporary);
      } catch {}
      throw error;
    }
  }
  return {
    status: write ? 'applied' : 'validated-without-writing',
    checked: batch.artworks.length,
    added: merged.artworks.length - registry.artworks.length,
    totalReviewed: merged.artworks.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const paths = args.filter((arg) => arg !== '--write');
  if (paths.length !== 1 || paths[0].startsWith('--'))
    throw new Error('Usage: node scripts/apply-editorial-review.mjs path/to/review.json [--write]');
  console.log(
    JSON.stringify(
      applyEditorialBatch(resolve(import.meta.dirname, '..'), paths[0], { write }),
      null,
      2,
    ),
  );
}
