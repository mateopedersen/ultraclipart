import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const load = async (path) =>
  import(
    'data:text/javascript;base64,' +
      Buffer.from(
        stripTypeScriptTypes(await fs.readFile(new URL(path, import.meta.url), 'utf8'), {
          mode: 'transform',
        }),
      ).toString('base64')
  );
const { History, changeLayers, validateDocument, identity } = await load('../src/editor/model.ts');
const { parsePath, lookupCmyk, paperLayout } = await load('../src/editor/pdf-math.ts');
const doc = () => ({
  version: 1,
  artId: 'test',
  width: 800,
  height: 800,
  background: 'transparent',
  crop: null,
  print: { paper: 'letter', orientation: 'portrait', margin: 0.5, scale: 'fit' },
  layers: [
    {
      id: 'a',
      label: 'Shape',
      visible: true,
      locked: false,
      opacity: 1,
      kind: 'vector',
      markup: '<path d="M0 0L10 10Z"/>',
      ...identity(),
    },
    {
      id: 'b',
      label: 'Locked',
      visible: true,
      locked: true,
      opacity: 1,
      kind: 'vector',
      markup: '<circle r="10"/>',
      ...identity(),
    },
  ],
});
test('raster projects bind a compact image reference to the current artwork and reject foreign or invalid sources', () => {
  const value = doc();
  value.layers = [
    {
      id: 'original-image',
      label: 'Original image',
      kind: 'raster',
      assetId: 'test',
      sourceSha256: 'a'.repeat(64),
      width: 1382,
      height: 1382,
      visible: true,
      locked: false,
      opacity: 1,
      ...identity(),
    },
  ];
  assert.ok(validateDocument(value, 'test'));
  assert.ok(JSON.stringify(value).length < 1000);
  for (const patch of [
    { assetId: 'foreign-artwork' },
    { sourceSha256: 'https://attacker.invalid/image.webp' },
    { width: Infinity },
    { height: 0 },
    { width: 4097 },
  ]) {
    assert.equal(
      validateDocument({ ...value, layers: [{ ...value.layers[0], ...patch }] }, 'test'),
      false,
    );
  }
  const h = new History(value);
  h.commit(
    changeLayers(h.current, ['original-image'], (layer) => {
      layer.x = 37;
      layer.angle = 14;
      layer.opacity = 0.6;
    }),
  );
  assert.equal(h.current.layers[0].sourceSha256, value.layers[0].sourceSha256);
  assert.deepEqual(h.undo(), value);
});
test('mixed edit history restores exact documents; a new edit invalidates redo', () => {
  const original = doc(),
    h = new History(original);
  h.commit(
    changeLayers(h.current, ['a', 'b'], (l) => {
      l.x = 35;
      l.opacity = 0.7;
    }),
  );
  assert.equal(h.current.layers[1].x, 0);
  const changed = structuredClone(h.current);
  h.commit({ ...h.current, background: '#ffffff' });
  assert.deepEqual(h.undo(), changed);
  assert.deepEqual(h.undo(), original);
  assert.deepEqual(h.redo(), changed);
  h.commit({ ...h.current, background: '#2865d2' });
  assert.equal(h.canRedo, false);
  assert.deepEqual(original, doc());
});
test('history retains 75 independent edits and never aliases mutable inputs', () => {
  const h = new History({ value: 0 });
  for (let i = 1; i <= 80; i++) h.commit({ value: i });
  for (let i = 0; i < 75; i++) h.undo();
  assert.equal(h.current.value, 5);
  assert.equal(h.canUndo, false);
  for (let i = 0; i < 75; i++) h.redo();
  assert.equal(h.current.value, 80);
});
test('project validation rejects other artworks, invalid transforms and duplicate IDs', () => {
  assert.equal(validateDocument(doc(), 'test'), true);
  assert.equal(validateDocument(doc(), 'other'), false);
  let d = doc();
  d.layers[0].scaleX = -1;
  assert.equal(validateDocument(d, 'test'), false);
  d = doc();
  d.layers[1].id = 'a';
  assert.equal(validateDocument(d, 'test'), false);
  d = doc();
  d.layers[0].opacity = Infinity;
  assert.equal(validateDocument(d, 'test'), false);
});
test('relative, quadratic and smooth vector paths become exact cubic commands', () => {
  assert.deepEqual(parsePath('M10 10 l10 0 v10 h-10 z'), [
    { op: 'm', c: [10, 10] },
    { op: 'l', c: [20, 10] },
    { op: 'l', c: [20, 20] },
    { op: 'l', c: [10, 20] },
    { op: 'h', c: [] },
  ]);
  const p = parsePath('M0 0 Q3 6 6 0 T12 0');
  assert.deepEqual(p[1], { op: 'c', c: [2, 4, 4, 4, 6, 0] });
  assert.deepEqual(p[2], { op: 'c', c: [8, -4, 10, -4, 12, 0] });
  assert.throws(() => parsePath('M0 0 C2 3'), /incomplete/);
  assert.throws(() => parsePath('M0 0 R10 10'), /does not support/);
});

test('elliptical PDF arcs preserve endpoints, sweep, rotation and corrected radii', () => {
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8);
  const quarter = parsePath('M10 0 A10 10 0 0 1 0 10');
  assert.equal(quarter.length, 2);
  const k = (40 / 3) * Math.tan(Math.PI / 8);
  quarter[1].c.forEach((n, i) => near(n, [10, k, k, 10, 0, 10][i]));
  assert.deepEqual(parsePath('m10 0 a10 10 0 0 1 -10 10'), quarter);
  const reverse = parsePath('M0 10 A10 10 0 0 0 10 0');
  reverse[1].c.forEach((n, i) => near(n, [k, 10, 10, k, 10, 0][i]));
  assert.equal(parsePath('M10 0 A10 10 0 1 1 0 10').length, 4);
  const rotated = parsePath('M0 20 A20 10 90 0 1 -10 0');
  rotated[1].c.forEach((n, i) => near(n, [-k, 20, -10, 2 * k, -10, 0][i]));
  const corrected = parsePath('M0 0 A5 5 0 0 1 20 0');
  near(corrected[1].c[4], 10);
  near(corrected[1].c[5], -10);
  assert.deepEqual(corrected.at(-1).c.slice(-2), [20, 0]);
  assert.deepEqual(parsePath('M1 2 A0 4 0 0 1 3 4'), [
    { op: 'm', c: [1, 2] },
    { op: 'l', c: [3, 4] },
  ]);
  assert.equal(parsePath('M1 2 A4 4 0 0 1 1 2').length, 1);
  assert.throws(() => parsePath('M0 0 A4 4 0 2 1 8 0'), /invalid.*flag/);
});
test('print layout preserves physical paper dimensions, margins, aspect ratio and crop', () => {
  const d = doc();
  let p = paperLayout(d);
  assert.equal(p.pageWidth, 612);
  assert.equal(p.pageHeight, 792);
  assert.equal(p.width, 540);
  assert.equal(p.height, 540);
  assert.equal(p.x, 36);
  d.print.orientation = 'landscape';
  p = paperLayout(d);
  assert.equal(p.pageWidth, 792);
  assert.equal(p.pageHeight, 612);
  d.crop = { x: 50, y: 50, width: 400, height: 200 };
  p = paperLayout(d);
  assert.equal(p.width / p.height, 2);
  assert.ok(p.x >= 36 && p.y >= 36);
});
test('CMYK lookup interpolates RGB grid and preserves paper white and process black', () => {
  const values = [];
  for (let r = 0; r < 2; r++)
    for (let g = 0; g < 2; g++) for (let b = 0; b < 2; b++) values.push(1 - r, 1 - g, 1 - b, 0);
  const lut = { gridSize: 2, values };
  assert.deepEqual(lookupCmyk('#ffffff', lut), [0, 0, 0, 0]);
  assert.deepEqual(lookupCmyk('#000000', lut), [0, 0, 0, 1]);
  assert.deepEqual(lookupCmyk('#ff0000', lut), [0, 1, 1, 0]);
  const m = lookupCmyk('#808080', lut);
  assert.ok(Math.abs(m[3] - 127 / 255) < 1e-8);
  assert.equal(m[0], 0);
  assert.ok(m.every((v) => v >= 0 && v <= 1));
});
test('actual GRACoL conversion table is complete and nontrivial', async () => {
  const lut = JSON.parse(
    await fs.readFile(new URL('../public/color/cmyk-lut.json', import.meta.url), 'utf8'),
  );
  assert.equal(lut.values.length, lut.gridSize ** 3 * 4);
  assert.match(lut.profileName, /GRACoL/);
  for (const color of ['#2865d2', '#f38b23', '#2a8555']) {
    const values = lookupCmyk(color, lut);
    assert.ok(values.every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
    assert.ok(values.some((v) => v > 0.1));
  }
});
