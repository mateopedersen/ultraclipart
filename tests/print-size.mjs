import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePrintSize } from '../src/lib/print-size.ts';
const input = {
  pixelsWide: 2048,
  pixelsHigh: 2048,
  widthInches: 4,
  paper: 'letter',
  landscape: false,
  marginInches: 0.5,
};
test('print geometry preserves aspect ratio and computes real image density', () => {
  const square = calculatePrintSize(input);
  assert.equal(square.ppi, 512);
  assert.equal(square.heightInches, 4);
  assert.equal(square.fits, true);
  assert.equal(square.fitWidth, 7.5);
  const portrait = calculatePrintSize({ ...input, pixelsHigh: 4096, widthInches: 6 });
  assert.equal(portrait.heightInches, 12);
  assert.equal(portrait.fits, false);
  assert.equal(portrait.fitWidth, 5);
});
test('A4 millimeter conversion, landscape, and margins constrain both axes', () => {
  const value = calculatePrintSize({ ...input, paper: 'a4', landscape: true });
  assert.ok(Math.abs(value.usableWidth - (297 / 25.4 - 1)) < 1e-10);
  assert.ok(Math.abs(value.fitWidth - (210 / 25.4 - 1)) < 1e-10);
  assert.equal(calculatePrintSize({ ...input, widthInches: 7.5 }).fits, true);
  assert.equal(calculatePrintSize({ ...input, widthInches: 7.5001 }).fits, false);
});
test('invalid dimensions fail closed instead of displaying stale or infinite results', () => {
  for (const key of ['pixelsWide', 'pixelsHigh', 'widthInches', 'marginInches'])
    for (const value of [NaN, Infinity, -1])
      assert.throws(() => calculatePrintSize({ ...input, [key]: value }), RangeError);
  for (const key of ['pixelsWide', 'pixelsHigh', 'widthInches'])
    assert.throws(() => calculatePrintSize({ ...input, [key]: 0 }), RangeError);
  assert.throws(() => calculatePrintSize({ ...input, pixelsWide: 1.5 }), RangeError);
  assert.throws(() => calculatePrintSize({ ...input, paper: 'fake' }), RangeError);
});
