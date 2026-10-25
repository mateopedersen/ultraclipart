import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
test('published branded waves retain their reviewed identity and matching representations', () => {
  const catalog = read('data/art.json');
  const cache = new Map();
  for (const artwork of catalog) {
    const path = `data/waves/${artwork.sourceCollection}-plan.json`;
    if (!existsSync(resolve(root, path))) continue;
    if (!cache.has(path)) cache.set(path, read(path));
    const plan = cache.get(path);
    if (!plan.identityReview) continue;
    const review = read(plan.identityReview).artworks.find((entry) => entry.id === artwork.id);
    const exported = read(`data/waves/${artwork.sourceCollection}.json`).artworks.find(
      (entry) => entry.id === artwork.id,
    );
    assert.equal(review?.status, 'PASS', `unreviewed identity: ${artwork.id}`);
    assert.equal(
      exported?.sourceSha256,
      review.sourceSha256,
      `stale inspected source: ${artwork.id}`,
    );
    assert.equal(exported.source, review.source, `wrong selected version: ${artwork.id}`);
    for (const key of ['title', 'alt', 'description'])
      assert.equal(artwork[key], review.metadata[key], `unreviewed ${key}: ${artwork.id}`);
    for (const kind of ['webp', 'pdf', 'thumb'])
      assert.equal(
        artwork.files[kind].sha256,
        exported.files[kind].sha256,
        `changed ${kind}: ${artwork.id}`,
      );
  }
});
