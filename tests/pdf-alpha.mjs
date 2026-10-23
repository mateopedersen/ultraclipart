import test from 'node:test';
import assert from 'node:assert/strict';
import { deflate } from 'pako';
import { inflateAlpha, predictAlpha, compactSoftMasks } from '../src/editor/pdf-alpha.ts';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { readFileSync } from 'node:fs';
test('alpha decoding enforces exact dimensions and rejects oversized, short and corrupt streams', () => {
  const bytes = new Uint8Array(10000).fill(255);
  assert.deepEqual(inflateAlpha(deflate(bytes), bytes.length), bytes);
  assert.throws(() => inflateAlpha(deflate(bytes), 9999), /exceeds/);
  assert.throws(() => inflateAlpha(deflate(bytes), 10001), /length/);
  assert.throws(() => inflateAlpha(new Uint8Array([0, 1, 2]), 10));
  assert.throws(() => predictAlpha(bytes, 4097, 1));
  assert.throws(() => predictAlpha(bytes, 100, 99));
});
test('row prediction handles one-pixel rows and reversible unsigned byte wrapping', () => {
  assert.deepEqual(
    [...predictAlpha(new Uint8Array([255, 0, 128]), 1, 3, 'sub')],
    [1, 255, 1, 0, 1, 128],
  );
  assert.deepEqual([...predictAlpha(new Uint8Array([255, 0, 128]), 3, 1, 'sub')], [1, 255, 1, 128]);
});
test('near-cap source gains headroom without touching its CMYK stream; compaction is idempotent', async () => {
  const bytes = readFileSync(
    new URL('../public/catalog/baby/baby-making-handprint-art-clipart.pdf', import.meta.url),
  );
  const doc = await PDFDocument.load(bytes);
  const streams = () =>
    doc.context
      .enumerateIndirectObjects()
      .map(([, o]) => o)
      .filter((o) => o instanceof PDFRawStream);
  const cmyk = streams()
    .find((o) => String(o.dict.get(PDFName.of('ColorSpace'))) === '/DeviceCMYK')
    .getContents()
    .slice();
  const size = () => streams().reduce((sum, stream) => sum + stream.getContents().length, 0);
  const before = size();
  await compactSoftMasks(doc);
  const after = size();
  assert.ok(before - after > 3000);
  assert.deepEqual(
    streams()
      .find((o) => String(o.dict.get(PDFName.of('ColorSpace'))) === '/DeviceCMYK')
      .getContents(),
    cmyk,
  );
  await compactSoftMasks(doc);
  assert.equal(size(), after);
});
