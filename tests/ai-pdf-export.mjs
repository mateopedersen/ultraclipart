import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const source = stripTypeScriptTypes(
  await fs.readFile(new URL('../src/ai/pdf-export.ts', import.meta.url), 'utf8'),
  { mode: 'transform' },
);
const { aiPdfLayout } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);
test('AI PDF uses native pixel detail at 300 PPI, centered on Letter within half-inch margins', () => {
  const l = aiPdfLayout(1024, 1024);
  assert.equal(l.canvasWidth, 2250);
  assert.equal(l.canvasHeight, 3000);
  assert.equal(l.scale, 1);
  assert.equal(l.effectivePpi, 300);
  assert.equal(l.printWidthInches, 1024 / 300);
  assert.equal(l.printHeightInches, 1024 / 300);
  assert.equal(l.x, (2250 - 1024) / 2);
  assert.equal(l.y, (3000 - 1024) / 2);
});
test('oversized or wide native artwork fits on paper without resampling or clipping', () => {
  const l = aiPdfLayout(4096, 2048);
  assert.equal(l.printWidthInches, 7.5);
  assert.equal(l.printHeightInches, 3.75);
  assert.equal(l.scale, 2250 / 4096);
  assert.equal(l.effectivePpi, 4096 / 7.5);
  assert.equal(l.x, 0);
  const a4 = aiPdfLayout(1000, 4096, 'a4');
  assert.ok(a4.printHeightInches < 10.7);
  assert.ok(a4.effectivePpi > 300);
  assert.equal(a4.y, 0);
  assert.ok(a4.x >= 0);
});
test('unsupported paper and invalid image dimensions fail before export', () => {
  for (const [w, h] of [
    [0, 100],
    [4097, 100],
    [100, Infinity],
    [100.5, 200],
  ])
    assert.throws(() => aiPdfLayout(w, h));
  assert.throws(() => aiPdfLayout(1024, 1024, 'poster'));
});
