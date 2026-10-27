import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mergeEditorialBatch, applyEditorialBatch } from '../scripts/apply-editorial-review.mjs';

const registry = JSON.parse(
  readFileSync(new URL('../data/editorial/reviews.json', import.meta.url)),
);
const catalog = JSON.parse(readFileSync(new URL('../data/art.json', import.meta.url)));
const first = registry.artworks[0];
const second = registry.artworks[1];

test('batch import validates every image before allowing an atomic registry replacement', () => {
  const unchanged = structuredClone(registry);
  const draft = { ...second, status: 'pending-visual-review' };
  assert.throws(
    () => mergeEditorialBatch(catalog, registry, { schema: 1, artworks: [first, draft] }),
    /actual image review/,
  );
  assert.deepEqual(registry, unchanged);
  assert.throws(
    () => mergeEditorialBatch(catalog, registry, { schema: 1, artworks: [first, first] }),
    /Duplicate batch ID/,
  );
  assert.throws(
    () =>
      mergeEditorialBatch(catalog, registry, {
        schema: 1,
        artworks: [{ ...first, id: 'missing' }],
      }),
    /Unknown artwork/,
  );
  assert.throws(
    () =>
      mergeEditorialBatch(catalog, registry, {
        schema: 1,
        artworks: [{ ...first, imageSha256: '0'.repeat(64) }],
      }),
    /image changed/,
  );
});

test('batch import preserves unrelated reviews and does not publish preparation-only paths', () => {
  const updated = structuredClone(first);
  updated.number = 1;
  updated.originalPath = '/private/review-path';
  const merged = mergeEditorialBatch(catalog, registry, { schema: 1, artworks: [updated] });
  assert.equal(merged.artworks.length, registry.artworks.length);
  assert.deepEqual(
    merged.artworks.find((r) => r.id === second.id),
    second,
  );
  assert.deepEqual(
    merged.artworks.find((r) => r.id === first.id),
    first,
  );
});

test('dry run writes nothing and an invalid batch cannot partially change the registry', () => {
  const root = mkdtempSync(join(tmpdir(), 'uc-editorial-'));
  try {
    mkdirSync(join(root, 'data/editorial'), { recursive: true });
    writeFileSync(join(root, 'data/art.json'), JSON.stringify(catalog));
    const original = JSON.stringify(registry, null, 2) + '\n';
    const target = join(root, 'data/editorial/reviews.json');
    writeFileSync(target, original);
    writeFileSync(join(root, 'batch.json'), JSON.stringify({ schema: 1, artworks: [first] }));
    assert.equal(applyEditorialBatch(root, 'batch.json').status, 'validated-without-writing');
    assert.equal(readFileSync(target, 'utf8'), original);
    assert.equal(applyEditorialBatch(root, 'batch.json', { write: true }).status, 'applied');
    assert.equal(readFileSync(target, 'utf8'), original);
    writeFileSync(
      join(root, 'batch.json'),
      JSON.stringify({ schema: 1, artworks: [first, { ...second, observations: [] }] }),
    );
    assert.throws(
      () => applyEditorialBatch(root, 'batch.json', { write: true }),
      /visible evidence/,
    );
    assert.equal(readFileSync(target, 'utf8'), original);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
