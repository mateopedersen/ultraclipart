import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const load = async (file) => {
  let source = await fs.readFile(new URL(file, import.meta.url), 'utf8');
  if (file.endsWith('/elements.ts')) {
    const icons = await fs.readFile(
      new URL('../data/studio-tabler-elements.json', import.meta.url),
      'utf8',
    );
    source = source.replace(
      "import tablerElements from '../../data/studio-tabler-elements.json';",
      `const tablerElements = ${icons};`,
    );
  }
  return import(
    'data:text/javascript;base64,' +
      Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')
  );
};
const { studioElements, elementCategories } = await load('../src/editor/elements.ts');
const { parsePath } = await load('../src/editor/pdf-math.ts');
const { validateDocument } = await load('../src/editor/model.ts');
const { blankDocument, vectorLayer } = await load('../src/editor/creation.ts');
test('2,000 editable elements have unique IDs, names and vector markup', () => {
  assert.equal(studioElements.length, 2000);
  for (const key of ['id', 'name', 'markup'])
    assert.equal(new Set(studioElements.map((e) => e[key])).size, 2000, key);
  assert.ok(elementCategories.length >= 12);
  for (const e of studioElements) {
    assert.doesNotMatch(e.markup, /NaN|Infinity|script|image|filter|url\(|<text/);
    for (const [, d] of e.markup.matchAll(/\sd="([^"]+)"/g)) {
      const ops = parsePath(d);
      assert.ok(ops.length, e.name);
      assert.ok(
        ops.every((op) => op.c.every(Number.isFinite)),
        e.name,
      );
    }
  }
});
test('the complete library works in batches within the existing 500-layer limit', () => {
  for (let offset = 0; offset < studioElements.length; offset += 250) {
    const d = blankDocument('studio');
    d.layers = studioElements
      .slice(offset, offset + 250)
      .map((e, i) => vectorLayer(`element-${i}`, e.name, e.markup));
    assert.ok(validateDocument(d, 'studio'));
    assert.ok(JSON.stringify(d).length < 16000000);
  }
});
test('typography stays backwards compatible and rejects invalid new fields', () => {
  const d = blankDocument('studio');
  const layer = {
    ...vectorLayer('text', 'Text', ''),
    kind: 'text',
    text: 'Hello',
    size: 48,
    color: '#14234d',
    bold: true,
    align: 'start',
  };
  delete layer.markup;
  d.layers = [layer];
  assert.ok(validateDocument(d, 'studio'));
  layer.typography = {
    layout: 'arc',
    font: 'serif',
    radius: 150,
    spacing: 2,
    lineHeight: 1.4,
    stroke: '#ffffff',
    strokeWidth: 2,
    shadow: true,
  };
  assert.ok(validateDocument(d, 'studio'));
  layer.typography.italic = true;
  layer.typography.decoration = 'underline';
  assert.ok(validateDocument(d, 'studio'));
  layer.typography.italic = 'yes';
  assert.equal(validateDocument(d, 'studio'), false);
  layer.typography.italic = false;
  layer.typography.decoration = 'unsupported';
  assert.equal(validateDocument(d, 'studio'), false);
});

const { repeatSelection } = await load('../src/editor/repeat.ts');
test('repeat creates independent groups and preserves the source and locked layers', () => {
  const d = blankDocument('studio');
  d.layers = [
    vectorLayer('a', 'A', '<rect width="40" height="50"/>', 10, 20),
    vectorLayer('b', 'B', '<rect width="10" height="10"/>', 50, 20),
  ];
  d.layers.forEach((l) => (l.group = 'linked'));
  const r = repeatSelection(
    d,
    ['a', 'b'],
    { x: 10, y: 20, width: 50, height: 50 },
    { rows: 2, columns: 2, gapX: 10, gapY: 20, stagger: true, expand: true },
  );
  assert.equal(d.layers.length, 2);
  assert.equal(r.doc.layers.length, 8);
  assert.equal(new Set(r.doc.layers.map((l) => l.id)).size, 8);
  assert.equal(new Set(r.doc.layers.map((l) => l.group)).size, 4);
  assert.equal(r.doc.layers[4].x, 40);
  assert.ok(validateDocument(r.doc, 'studio'));
  assert.throws(
    () =>
      repeatSelection(
        d,
        ['a'],
        { x: 0, y: 0, width: 50, height: 50 },
        { rows: 2, columns: 2, gapX: 0, gapY: 0, stagger: false, expand: true },
      ),
    /every part/,
  );
  assert.throws(
    () =>
      repeatSelection(
        d,
        ['a', 'b'],
        { x: 0, y: 0, width: 4000, height: 4000 },
        { rows: 2, columns: 2, gapX: 0, gapY: 0, stagger: false, expand: true },
      ),
    /4,096/,
  );
});
test('repeat enforces the layer limit before creating copies', () => {
  const d = blankDocument('studio');
  d.layers = Array.from({ length: 6 }, (_, i) =>
    vectorLayer('layer' + i, 'Part', '<rect width="1" height="1"/>'),
  );
  assert.throws(
    () =>
      repeatSelection(
        d,
        d.layers.map((l) => l.id),
        { x: 0, y: 0, width: 50, height: 50 },
        { rows: 10, columns: 10, gapX: 0, gapY: 0, stagger: false, expand: false },
      ),
    /500/,
  );
});
