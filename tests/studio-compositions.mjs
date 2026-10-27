import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const bundled = await build({
  stdin: {
    contents:
      "export { studioScenes } from './src/lib/studio-scenes.ts'; export { buildStudioComposition } from './src/lib/studio-compositions.ts'; export { validateDocument } from './src/editor/model.ts';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { studioScenes, buildStudioComposition, validateDocument } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
);
const metadata = JSON.parse(readFileSync('data/art.json', 'utf8')),
  sizes = new Map(metadata.map((a) => [a.id, a]));
test('all 18 distinct compositions satisfy the real project contract', () => {
  assert.equal(studioScenes.length, 18);
  const signatures = new Set();
  for (const scene of studioScenes) {
    const plan = buildStudioComposition(scene, sizes);
    const layers = plan.layers.map((l) =>
      l.kind === 'artwork'
        ? {
            kind: 'raster',
            id: l.id,
            label: l.label,
            assetId: l.artworkId,
            sourceSha256: '0'.repeat(64),
            width: sizes.get(l.artworkId).width,
            height: sizes.get(l.artworkId).height,
            x: l.x,
            y: l.y,
            scaleX: l.width / sizes.get(l.artworkId).width,
            scaleY: l.height / sizes.get(l.artworkId).height,
            angle: 0,
            visible: true,
            locked: false,
            opacity: 1,
          }
        : l,
    );
    const document = {
      version: 2,
      title: scene.title,
      artId: 'my-clipart',
      width: plan.width,
      height: plan.height,
      background: plan.background,
      crop: null,
      layers,
      print: { paper: 'a4', orientation: 'landscape', margin: 0.5, scale: 'fit' },
    };
    assert.equal(validateDocument(document, 'my-clipart'), true, scene.id);
    assert.equal(new Set(layers.map((l) => l.id)).size, layers.length);
    assert.ok(layers.length >= 10);
    signatures.add(JSON.stringify(layers));
    for (const l of plan.layers.filter((l) => l.kind === 'artwork')) {
      assert.ok(l.x >= 0 && l.y >= 0);
      assert.ok(l.x + l.width <= plan.width + 0.01);
      assert.ok(l.y + l.height <= plan.height + 0.01);
    }
  }
  assert.equal(signatures.size, 18);
});
