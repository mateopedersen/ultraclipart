import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypescript } from './helpers/typescript.mjs';
const { validAiMetadata, validateDocument, identity, History } =
  await loadTypescript('src/editor/model.ts');
const { normalizeMetadata, validTransferId, jpegDimensions } =
  await loadTypescript('src/ai/transfer.ts');
const { extractSelectionPixels, extractedDocument } = await loadTypescript(
  'src/editor/smart/extract.ts',
);
const { encodeMask } = await loadTypescript('src/editor/smart/pixels.ts');
const meta = {
  prompt: 'Yavru fil — üç mavi balon 🐘',
  model: '@cf/black-forest-labs/flux-1-schnell',
  style: 'watercolor',
  createdAt: '2026-10-24T10:00:00.000Z',
};
const id = '22222222-2222-4222-8222-222222222222';
const raster = (id = 'source') => ({
  id,
  kind: 'raster',
  assetId: `local-${id}`,
  sourceSha256: 'a'.repeat(64),
  width: 4,
  height: 4,
  label: 'Source',
  visible: true,
  locked: false,
  opacity: 0.7,
  ...identity(),
});
const document = () => ({
  version: 2,
  artId: 'my-clipart',
  width: 800,
  height: 800,
  background: 'transparent',
  crop: null,
  print: { paper: 'letter', orientation: 'portrait', margin: 0.5, scale: 'fit' },
  layers: [raster()],
  selection: { layerId: 'source', mask: encodeMask(new Uint8Array(16).fill(255), 4, 4) },
});
test('transfer validates Unicode private metadata, IDs and unsupported fields', () => {
  assert.deepEqual(normalizeMetadata(meta), { ...meta, version: 1 });
  assert.equal(validTransferId(id), true);
  for (const bad of ['../image', 'data:image/png;base64,xxx', '<script>', id + '?x'])
    assert.equal(validTransferId(bad), false);
  for (const invalid of [
    { ...meta, prompt: 'a'.repeat(2049) },
    { ...meta, prompt: '\0' },
    { ...meta, model: {} },
    { ...meta, seed: -1 },
    { ...meta, createdAt: 'tomorrow' },
    { ...meta, url: 'https://example.test/' },
  ])
    assert.throws(() => normalizeMetadata(invalid));
  assert.equal(validAiMetadata({ ...meta, version: 1, transferId: id }), true);
  assert.equal(validAiMetadata({ ...meta, version: 1, transferId: 'unsafe' }), false);
});
test('project schema accepts optional generation provenance, rejects corrupt metadata, keeps older projects compatible', () => {
  const d = document();
  assert.equal(validateDocument(d, d.artId), true);
  d.layers[0].ai = normalizeMetadata(meta);
  assert.equal(validateDocument(d, d.artId), true);
  d.layers[0].ai.seed = Infinity;
  assert.equal(validateDocument(d, d.artId), false);
});
test('extraction maps source coordinates into padded effect pixels and multiplies actual alpha without mutating source', () => {
  const image = { width: 6, height: 6, data: new Uint8ClampedArray(6 * 6 * 4) };
  image.data.set([10, 20, 30, 200], (2 * 6 + 3) * 4);
  image.data.set([80, 90, 100, 255], (3 * 6 + 4) * 4);
  const mask = new Uint8Array(16);
  mask[1 * 4 + 2] = 128;
  mask[2 * 4 + 3] = 255;
  const before = structuredClone(image);
  const out = extractSelectionPixels(image, encodeMask(mask, 4, 4), { x: -1, y: -1 });
  assert.deepEqual(
    { x: out.x, y: out.y, width: out.width, height: out.height },
    { x: 2, y: 1, width: 2, height: 2 },
  );
  assert.deepEqual([...out.data], [10, 20, 30, 100, 0, 0, 0, 0, 0, 0, 0, 0, 80, 90, 100, 255]);
  assert.deepEqual(image, before);
  assert.throws(
    () => extractSelectionPixels(image, encodeMask(new Uint8Array(16), 4, 4), { x: -1, y: -1 }),
    /visible pixels/,
  );
});
test('independent cutout preserves a rotated nonuniform scaled source placement and history', () => {
  const d = document(),
    source = d.layers[0];
  Object.assign(source, { x: 20, y: 30, scaleX: 2, scaleY: 3, angle: 90 });
  source.ai = normalizeMetadata(meta);
  const history = new History(d),
    cutout = raster('cutout');
  const next = extractedDocument(d, 'source', cutout, { x: 2, y: 1 }, true, 'Baby elephant');
  assert.equal(next.layers.length, 2);
  assert.equal(next.layers[1].x, 17);
  assert.equal(next.layers[1].y, 34);
  assert.equal(next.layers[1].angle, 90);
  assert.equal(next.layers[1].scaleY, 3);
  assert.equal(next.layers[1].opacity, 0.7);
  assert.deepEqual(next.layers[1].ai, source.ai);
  assert.equal(next.layers[0].regions[0].operation, 'erase');
  assert.equal(next.layers[0].regions[0].stage, 'after-effects');
  assert.equal(next.selection, undefined);
  assert.equal(source.regions, undefined);
  history.commit(next);
  history.undo();
  assert.deepEqual(history.current, d);
  history.redo();
  assert.deepEqual(history.current, next);
  const copy = extractedDocument(d, 'source', cutout, { x: 0, y: 0 }, false, '');
  assert.equal(copy.layers[0].regions, undefined);
});
test('extraction fails closed at image/layer/pixel/region limits and locked source', () => {
  const d = document();
  d.layers = Array.from({ length: 12 }, (_, n) => raster(n ? `source${n}` : 'source'));
  assert.throws(
    () => extractedDocument(d, 'source', raster('new'), { x: 0, y: 0 }, false, 'Object'),
    /limit/,
  );
  const locked = document();
  locked.layers[0].locked = true;
  assert.throws(
    () => extractedDocument(locked, 'source', raster('new'), { x: 0, y: 0 }, false, 'Object'),
    /unlocked/,
  );
  const big = document();
  big.layers[0].width = 4096;
  big.layers[0].height = 4096;
  big.layers.push({ ...raster('big2'), width: 4096, height: 4096 });
  assert.throws(
    () =>
      extractedDocument(
        big,
        'source',
        { ...raster('big3'), width: 4096, height: 4096 },
        { x: 0, y: 0 },
        false,
        'Object',
      ),
    /limit/,
  );
});

test('JPEG frame dimensions are bounded before decode, malformed and huge frames are rejected', () => {
  const jpeg = Uint8Array.from([255, 216, 255, 192, 0, 8, 8, 4, 0, 4, 0, 1, 255, 217]);
  assert.deepEqual(jpegDimensions(jpeg), { width: 1024, height: 1024 });
  const huge = jpeg.slice();
  huge[9] = 255;
  huge[10] = 255;
  assert.throws(() => jpegDimensions(huge), /4096/);
  assert.throws(() => jpegDimensions(jpeg.slice(0, 6)), /Incomplete/);
  assert.throws(() => jpegDimensions(Uint8Array.from([255, 216, 255, 218, 0, 0])), /verified/);
});
