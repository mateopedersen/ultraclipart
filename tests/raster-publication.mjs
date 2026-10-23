import test from 'node:test';
import assert from 'node:assert/strict';
import { artwork, manifestFor } from './fixtures/publication.mjs';
import { validatePublication, catalogFiles } from '../scripts/publication-policy.mjs';
import { validateBatch } from '../scripts/r2/plan.mjs';

function fixture() {
  const bodies = new Map(),
    item = artwork('volleyball-test', bodies);
  const manifest = manifestFor([item]);
  item.sourceType = 'raster';
  item.svg = null;
  delete item.files.svg;
  manifest.files = manifest.files
    .filter((f) => f.kind !== 'svg')
    .map((f) => ({ ...f, sourceType: 'raster' }));
  manifest.bytes = manifest.files.reduce((n, f) => n + f.bytes, 0);
  const batch = manifest.files.map((f) => ({
    assetId: f.assetId,
    sourceType: 'raster',
    kind: f.kind === 'thumb' ? 'thumbnail' : f.kind,
    bucket: 'ultraclipart-media',
    key: `${f.assetId}.${f.kind}.${f.sha256.slice(0, 16)}.${f.kind === 'thumb' ? 'webp' : f.kind}`,
    bytes: f.bytes,
    sha256: f.sha256,
  }));
  return { item, manifest, batch, read: (p) => bodies.get(p) };
}
test('explicit raster artworks publish three verified files without a fabricated SVG', () => {
  const f = fixture();
  assert.equal(validatePublication(f.manifest, [f.item], f.read).files, 3);
  assert.equal(validateBatch(f.batch).length, 3);
  assert.equal(
    catalogFiles([f.item]).some((x) => x.kind === 'svg'),
    false,
  );
});
test('missing SVG does not silently downgrade a layered source', () => {
  const f = fixture();
  delete f.item.sourceType;
  assert.throws(() => validatePublication(f.manifest, [f.item], f.read));
  delete f.batch[0].sourceType;
  assert.throws(() => validateBatch(f.batch), /Mixed artwork/);
});
test('raster records reject missing files, invented sources and unknown types', () => {
  let f = fixture();
  f.batch.pop();
  assert.throws(() => validateBatch(f.batch), /requires exactly/);
  f = fixture();
  f.item.svg = '/catalog/fake.svg';
  assert.throws(() => catalogFiles([f.item]), /fabricated/);
  f = fixture();
  f.item.sourceType = 'anything';
  assert.throws(() => catalogFiles([f.item]), /Unknown/);
  f = fixture();
  f.manifest.files[0].sourceType = 'layered';
  assert.throws(() => validatePublication(f.manifest, [f.item], f.read), /Mixed source/);
});
