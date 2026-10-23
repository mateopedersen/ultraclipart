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
const { shapeMarkup, shapeNames, freehandPath, blankDocument, vectorLayer, paintAttributes } =
  await load('../src/editor/creation.ts');
const { parsePath } = await load('../src/editor/pdf-math.ts');
const { validateDocument, History } = await load('../src/editor/model.ts');
const options = {
  width: 240,
  height: 180,
  sides: 5,
  rounding: 20,
  fill: '#b7cba5',
  stroke: '#1b293c',
  strokeWidth: 5,
};
test('all eight creation shapes are distinct finite vector geometry accepted by the print path parser', () => {
  const shapes = Object.keys(shapeNames).map((kind) => shapeMarkup(kind, options));
  assert.equal(shapes.length, 8);
  assert.equal(new Set(shapes).size, 8);
  for (const markup of shapes) {
    assert.doesNotMatch(markup, /NaN|Infinity|script|image|filter|url\(/);
    for (const match of markup.matchAll(/\sd="([^"]+)"/g)) {
      const ops = parsePath(match[1]);
      assert.equal(ops[0].op, 'm');
      assert.ok(ops.every((op) => op.c.every(Number.isFinite)));
    }
  }
  const d = blankDocument('studio');
  d.layers = shapes.map((markup, i) => vectorLayer(`shape-${i}`, 'Shape', markup));
  assert.equal(validateDocument(d, 'studio'), true);
});
test('parametric polygon and star change their actual point count; rounded corners change geometry', () => {
  for (const sides of [3, 6, 12]) {
    const polygon = shapeMarkup('polygon', { ...options, sides })
      .match(/points="([^"]+)"/)[1]
      .split(' ');
    const star = shapeMarkup('star', { ...options, sides })
      .match(/points="([^"]+)"/)[1]
      .split(' ');
    assert.equal(polygon.length, sides);
    assert.equal(star.length, 2 * sides);
  }
  assert.match(shapeMarkup('rounded', { ...options, rounding: 50 }), /rx="90"/);
  assert.match(shapeMarkup('rounded', { ...options, rounding: 0 }), /rx="0"/);
});
test('freehand interpolation preserves start and end and stays natively printable at the point limit', () => {
  const points = Array.from({ length: 2000 }, (_, i) => ({ x: i, y: 200 + Math.sin(i / 20) * 70 }));
  const ops = parsePath(freehandPath(points));
  assert.deepEqual(ops[0], { op: 'm', c: [0, 200] });
  assert.equal(ops.length, 2000);
  assert.equal(ops.at(-1).c[4], 1999);
  assert.ok(ops.slice(1).every((op) => op.op === 'c' && op.c.every(Number.isFinite)));
  assert.throws(() => freehandPath([{ x: 0, y: 0 }]), /2 to 2,000/);
  assert.throws(() => freehandPath([...points, points[0]]), /2 to 2,000/);
  assert.throws(
    () =>
      freehandPath([
        { x: 0, y: 0 },
        { x: Infinity, y: 0 },
      ]),
    /invalid coordinate/,
  );
});
test('creation rejects invisible, malicious or unbounded drawing parameters before markup insertion', () => {
  assert.throws(() => shapeMarkup('heart', { ...options, width: NaN }));
  assert.throws(() => shapeMarkup('ellipse', { ...options, height: 100000 }));
  assert.throws(() => shapeMarkup('polygon', { ...options, sides: 1000 }));
  assert.throws(() => shapeMarkup('star', { ...options, fill: 'url(https://bad.example)' }));
  assert.throws(
    () => paintAttributes({ fill: 'none', stroke: 'none', strokeWidth: 5 }),
    /visible stroke/,
  );
  assert.throws(() => shapeMarkup('line', { ...options, strokeWidth: 0 }), /visible stroke/);
  assert.throws(() => blankDocument('studio', 10, 800), /between/);
});
test('blank, resize and imported replacement remain ordinary reversible editor documents', () => {
  const blank = blankDocument('studio'),
    h = new History(blank),
    created = structuredClone(blank);
  created.layers.push(vectorLayer('heart', 'Heart', shapeMarkup('heart', options), 30, 40));
  h.commit(created);
  const resized = { ...created, width: 1200, height: 600, crop: null };
  h.commit(resized);
  h.commit(blankDocument('studio'));
  assert.deepEqual(h.undo(), resized);
  assert.deepEqual(h.undo(), created);
  assert.deepEqual(h.undo(), blank);
  assert.equal(validateDocument(resized, 'studio'), true);
});
test('imported project dimensions cannot create infinite print layouts', () => {
  for (const crop of [
    { x: 0, y: 0, width: 1e-308, height: 1e308 },
    { x: Infinity, y: 0, width: 800, height: 800 },
    { x: 20000, y: 0, width: 800, height: 800 },
  ])
    assert.equal(validateDocument({ ...blankDocument('studio'), crop }, 'studio'), false);
  assert.equal(validateDocument({ ...blankDocument('studio'), width: 1e-308 }, 'studio'), false);
});
const { rectangleRadii, paperLayout } = await load('../src/editor/pdf-math.ts');
test('PDF rectangle radii preserve SVG explicit-zero and missing-attribute semantics', () => {
  assert.deepEqual(rectangleRadii(100, 100, 0, 20), [0, 0]);
  assert.deepEqual(rectangleRadii(100, 100, 20, 0), [0, 0]);
  assert.deepEqual(rectangleRadii(100, 100, null, 20), [20, 20]);
  assert.deepEqual(rectangleRadii(40, 100, 30, null), [20, 30]);
  assert.throws(
    () =>
      paperLayout({
        ...blankDocument('studio'),
        crop: { x: 0, y: 0, width: 1e-308, height: 1e308 },
      }),
    /invalid print dimensions/,
  );
});
