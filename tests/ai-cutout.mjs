import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
const bundle = await build({
  entryPoints: ['src/ai/cutout.worker.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
});
function cleanup(pixels, width, height, tolerance = 28) {
  let result;
  const self = {
    postMessage(value) {
      result = value;
    },
  };
  runInNewContext(bundle.outputFiles[0].text, { self, Uint8ClampedArray, Uint8Array, Uint32Array });
  self.onmessage({ data: { pixels, width, height, tolerance } });
  return result;
}
const image = (size, color = [255, 255, 255, 255]) =>
  new Uint8ClampedArray(Array.from({ length: size * size }, () => color).flat());
const pixel = (pixels, size, x, y, rgba) => pixels.set(rgba, (y * size + x) * 4);
test('background cleanup removes only connected neutral edge pixels', () => {
  const pixels = image(3);
  pixel(pixels, 3, 1, 1, [30, 40, 50, 255]);
  const result = cleanup(pixels, 3, 3);
  assert.equal(result.removed, 8);
  assert.equal(result.pixels[3], 0);
  assert.deepEqual([...result.pixels.slice(16, 20)], [30, 40, 50, 255]);
});
test('enclosed white foreground details are retained', () => {
  const pixels = image(5);
  for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) pixel(pixels, 5, x, y, [20, 30, 40, 255]);
  pixel(pixels, 5, 2, 2, [255, 255, 255, 255]);
  const result = cleanup(pixels, 5, 5);
  assert.equal(result.removed, 16);
  assert.equal(result.pixels[(2 * 5 + 2) * 4 + 3], 255);
});
test('colored edge artwork and existing transparent pixels remain intact', () => {
  const pixels = image(3, [255, 240, 20, 255]);
  pixel(pixels, 3, 0, 0, [255, 255, 255, 0]);
  const result = cleanup(pixels, 3, 3, 80);
  assert.equal(result.removed, 0);
  assert.deepEqual(result.pixels, pixels);
});
test('tolerance changes actual alpha rather than painting white', () => {
  assert.equal(cleanup(image(3, [240, 240, 240, 255]), 3, 3, 0).removed, 0);
  const result = cleanup(image(3, [240, 240, 240, 255]), 3, 3, 20);
  assert.equal(result.removed, 9);
  assert.equal(result.pixels[3], 0);
});
test('invalid dimensions, pixel lengths and tolerance fail before cleanup', () => {
  for (const [pixels, w, h, t] of [
    [image(3), 0, 3, 28],
    [image(3), 3.5, 3, 28],
    [image(3), 5000, 3, 28],
    [image(3), 3, 3, NaN],
    [image(3), 3, 3, 101],
    [new Uint8ClampedArray(2), 3, 3, 28],
  ])
    assert.throws(() => cleanup(pixels, w, h, t), /Invalid background cleanup image/);
});
