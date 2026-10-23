import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypescript } from './helpers/typescript.mjs';
import { inflate } from 'pako';
const pixels = await loadTypescript('src/editor/smart/pixels.ts');
const effects = await loadTypescript('src/editor/smart/effects.ts');
const types = await loadTypescript('src/editor/smart/types.ts');
const model = await loadTypescript('src/editor/model.ts');
const { cmykStreams } = await loadTypescript('src/editor/smart/cmyk.ts');
const { contourPaths } = await loadTypescript('src/editor/smart/contour.ts');
const image = (w = 12, h = 8) => ({
  width: w,
  height: h,
  data: Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => (i % 4 === 3 ? 255 : 100)),
});
const region = (mask, w, h, patch = {}) => ({
  id: 'region',
  name: 'Region',
  visible: true,
  locked: false,
  mask: pixels.encodeMask(mask, w, h),
  adjustment: types.defaultAdjustment(),
  ...patch,
});
const opts = { tolerance: 12, contiguous: true, perceptual: true, connectivity: 4, smart: false };
test('mask encoding preserves every coverage value and rejects truncated/overflowed malicious runs', () => {
  for (const mask of [
    new Uint8Array(100),
    Uint8Array.from({ length: 100 }, (_, i) => i % 256),
    new Uint8Array(100).fill(255),
  ])
    assert.deepEqual(pixels.decodeMask(pixels.encodeMask(mask, 10, 10)), mask);
  for (const data of [
    '',
    btoa('\x00\xff'),
    btoa('\x65\xff'),
    btoa('\x80\x80\x80\x80\x80\x01\xff'),
    btoa('\x64'),
  ])
    assert.throws(() => pixels.decodeMask({ width: 10, height: 10, encoding: 'rle8', data }));
});
test('wand connectivity, noncontiguous mode, and alpha boundary separate identical colored objects', () => {
  const src = image(5, 3);
  for (let i = 0; i < 15; i++) {
    src.data[i * 4] = 255;
    src.data[i * 4 + 1] = 0;
    src.data[i * 4 + 2] = 0;
  }
  for (let y = 0; y < 3; y++) src.data[(y * 5 + 2) * 4 + 3] = 0;
  const contiguous = pixels.selectRegion(src, { x: 0, y: 1 }, opts),
    all = pixels.selectRegion(src, { x: 0, y: 1 }, { ...opts, contiguous: false });
  assert.equal(
    contiguous.reduce((n, v) => n + !!v, 0),
    6,
  );
  assert.equal(
    all.reduce((n, v) => n + !!v, 0),
    12,
  );
  assert.equal(all[2], 0);
  assert.equal(pixels.selectRegion(src, { x: 2, y: 1 }, opts).some(Boolean), false);
});
test('4 versus 8 neighbors and RGB versus perceptual modes are functional', () => {
  const src = image(3, 3);
  src.data.fill(0);
  for (const i of [0, 4, 8]) {
    src.data[i * 4] = 200;
    src.data[i * 4 + 3] = 255;
  }
  for (const perceptual of [false, true]) {
    assert.equal(
      pixels.selectRegion(src, { x: 0, y: 0 }, { ...opts, perceptual }).filter(Boolean).length,
      1,
    );
    assert.equal(
      pixels
        .selectRegion(src, { x: 0, y: 0 }, { ...opts, perceptual, connectivity: 8 })
        .filter(Boolean).length,
      3,
    );
  }
});
test('recoloring retains all alpha, texture and exactly every unselected pixel', () => {
  const src = image(20, 10),
    mask = new Uint8Array(200);
  for (let i = 0; i < 200; i++) {
    const p = i * 4;
    src.data[p] = 90 + (i % 130);
    src.data[p + 1] = 40 + (i % 60);
    src.data[p + 2] = 35 + (i % 55);
    src.data[p + 3] = i % 256;
    if (i % 20 < 8) mask[i] = 255;
  }
  const snapshot = src.data.slice(),
    result = pixels.adjustPixels(src, [region(mask, 20, 10)]);
  let changed = 0;
  const lights = [];
  for (let i = 0; i < 200; i++) {
    assert.equal(result.data[i * 4 + 3], src.data[i * 4 + 3]);
    if (!mask[i])
      assert.deepEqual(result.data.slice(i * 4, i * 4 + 4), src.data.slice(i * 4, i * 4 + 4));
    else {
      changed += Number(result.data[i * 4] !== src.data[i * 4]);
      lights.push(result.data[i * 4 + 2]);
    }
  }
  assert.ok(changed > 50);
  assert.ok(new Set(lights).size > 20);
  assert.deepEqual(src.data, snapshot);
});
test('separate saved masks compose and hidden layers / zero intensity preserve source', () => {
  const src = image(10, 10),
    a = new Uint8Array(100),
    b = new Uint8Array(100);
  a[11] = 255;
  b[88] = 255;
  const first = region(a, 10, 10),
    second = region(b, 10, 10, {
      id: 'other',
      adjustment: { ...types.defaultAdjustment(), color: '#cc5599' },
    }),
    result = pixels.adjustPixels(src, [first, second]);
  assert.notDeepEqual(result.data.slice(44, 47), src.data.slice(44, 47));
  assert.notDeepEqual(result.data.slice(352, 355), src.data.slice(352, 355));
  assert.deepEqual(result.data.slice(80, 84), src.data.slice(80, 84));
  assert.deepEqual(pixels.adjustPixels(src, [{ ...first, visible: false }]).data, src.data);
  assert.deepEqual(
    pixels.adjustPixels(src, [{ ...first, adjustment: { ...first.adjustment, intensity: 0 } }])
      .data,
    src.data,
  );
});
test('mask morphology, filling, feather, add/subtract do not wrap image edges', () => {
  const mask = new Uint8Array(25);
  mask[12] = 255;
  assert.equal(pixels.morphology(mask, 5, 5, 1, true).filter(Boolean).length, 9);
  assert.equal(pixels.morphology(pixels.morphology(mask, 5, 5, 1, true), 5, 5, 1, false)[12], 255);
  const ring = new Uint8Array(25).fill(255);
  ring[12] = 0;
  assert.equal(pixels.fillHoles(ring, 5, 5)[12], 255);
  assert.equal(pixels.blurMask(mask, 5, 5, 1)[12], 28);
  const edge = new Uint8Array(25);
  edge[4] = 255;
  assert.equal(pixels.morphology(edge, 5, 5, 1, true)[5], 0);
  assert.equal(pixels.combineMasks(mask, mask, 'subtract').some(Boolean), false);
  assert.deepEqual(pixels.combineMasks(mask, new Uint8Array(25), 'add'), mask);
});
test('lasso and brush operate in native coordinates, soft erasing can be reversed', () => {
  const mask = pixels.polygonMask(
    [
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 4 },
      { x: 1, y: 4 },
    ],
    5,
    5,
  );
  assert.equal(mask.filter(Boolean).length, 9);
  const soft = new Uint8Array(400);
  pixels.brushMask(soft, 20, 20, { x: 5, y: 10 }, { x: 15, y: 10 }, 4, 0.5);
  assert.ok(soft.some((v) => v > 0 && v < 255));
  assert.equal(soft[0], 0);
  const src = image(20, 20),
    erased = pixels.adjustPixels(src, [region(soft, 20, 20, { operation: 'erase' })]);
  assert.equal(erased.data[(10 * 20 + 10) * 4 + 3], 0);
  assert.deepEqual(src.data.slice(0, 4), erased.data.slice(0, 4));
  const restored = pixels.adjustPixels(src, [
    region(soft, 20, 20, { operation: 'erase' }),
    region(new Uint8Array(400).fill(255), 20, 20, { operation: 'restore' }),
  ]);
  assert.deepEqual(restored.data, src.data);
});
test('clone reads a fixed source and repair never changes pixels outside its mask', () => {
  const src = image(10, 10);
  src.data[0] = 240;
  const mask = new Uint8Array(100);
  mask[22] = 255;
  for (const operation of ['clone', 'repair']) {
    const out = pixels.adjustPixels(src, [
      region(mask, 10, 10, { operation, offset: { x: -2, y: -2 } }),
    ]);
    for (let i = 0; i < 100; i++)
      if (i !== 22)
        assert.deepEqual(out.data.slice(i * 4, i * 4 + 4), src.data.slice(i * 4, i * 4 + 4));
    if (operation === 'clone') assert.equal(out.data[88], 240);
  }
});
test('patterns are constrained by the mask and preserve alpha for every pattern/blend', () => {
  const src = image(20, 20),
    mask = new Uint8Array(400);
  mask.fill(255, 100, 300);
  for (const kind of ['dots', 'stripes', 'plaid', 'diamonds', 'texture', 'gradient'])
    for (const blend of ['normal', 'multiply', 'screen']) {
      const out = pixels.adjustPixels(src, [
        region(mask, 20, 20, {
          adjustment: { ...types.defaultAdjustment(), mode: 'adjust' },
          pattern: { ...types.defaultPattern(), kind, blend, scale: 8, color: '#225599' },
        }),
      ]);
      assert.deepEqual(out.data.slice(0, 400), src.data.slice(0, 400));
      for (let i = 0; i < 400; i++) assert.equal(out.data[i * 4 + 3], src.data[i * 4 + 3]);
      assert.notDeepEqual(out.data, src.data);
    }
});
test('all effects have real outputs, preserve dimensions, and can be disabled', () => {
  const src = image(30, 30);
  for (let i = 0; i < 900; i++) {
    const x = i % 30,
      y = Math.floor(i / 30);
    src.data[i * 4] = x * 8;
    src.data[i * 4 + 1] = y * 8;
    src.data[i * 4 + 3] = x > 5 && x < 24 && y > 5 && y < 24 ? 255 : 0;
  }
  for (const kind of [
    'sticker',
    'coloring',
    'outline',
    'shadow',
    'inner-shadow',
    'glow',
    'blur',
    'sharpen',
    'balance',
    'emboss',
  ]) {
    const effect = { ...types.defaultEffect(kind), radius: 3, detail: 0.1 };
    const out = effects.applyEffects(src, [effect]);
    assert.equal(out.width, 30);
    assert.equal(out.data.length, src.data.length);
    assert.notDeepEqual(out.data, src.data, kind);
    assert.deepEqual(effects.applyEffects(src, [{ ...effect, enabled: false }]).data, src.data);
  }
});
test('cut contours close silhouette loops and quality inspector measures effective print PPI', () => {
  const mask = new Uint8Array(25);
  mask[12] = 255;
  assert.deepEqual(contourPaths(mask, 5, 5), ['M2 2L3 2L3 3L2 3L2 2Z']);
  const src = image(20, 10),
    r = effects.inspectImage(src, 0.1);
  assert.equal(r.effectivePpi, 200);
  assert.equal(r.transparentPercent, 0);
  assert.equal(r.emptyMarginPercent, 0);
});
test('CMYK streams use four actual components, reversible predictor and exact alpha', () => {
  const src = image(2, 1);
  src.data.set([255, 255, 255, 255, 0, 0, 0, 77]);
  const lut = { gridSize: 2, values: new Array(32).fill(0) };
  const streams = cmykStreams(src, lut),
    color = inflate(streams.colors),
    alpha = inflate(streams.alpha);
  assert.deepEqual([...unfilter(color, 2, 1, 4)], [0, 0, 0, 0, 0, 0, 0, 255]);
  assert.deepEqual([...unfilter(alpha, 2, 1, 1)], [255, 77]);
});
test('v1 projects migrate; v2 masks, history and multi-source references round-trip safely', () => {
  const d = {
    version: 1,
    artId: 'test',
    width: 10,
    height: 10,
    background: 'transparent',
    crop: null,
    print: { paper: 'letter', orientation: 'portrait', margin: 0.5, scale: 'fit' },
    layers: [
      {
        id: 'image',
        label: 'Image',
        kind: 'raster',
        assetId: 'test',
        sourceSha256: 'a'.repeat(64),
        width: 10,
        height: 10,
        visible: true,
        locked: false,
        opacity: 1,
        ...model.identity(),
      },
    ],
  };
  assert.ok(model.validateDocument(d, 'test'));
  const next = model.migrateDocument(d);
  next.layers[0].regions = [region(new Uint8Array(100).fill(255), 10, 10)];
  next.selection = { layerId: 'image', mask: next.layers[0].regions[0].mask };
  assert.ok(model.validateDocument(next, 'test'));
  const h = new model.History(d);
  h.commit(next);
  assert.deepEqual(h.undo(), d);
  assert.deepEqual(h.redo(), next);
  assert.deepEqual(JSON.parse(JSON.stringify(next)), next);
  next.layers[0].regions[0].mask.data = btoa('\x7f\xff');
  assert.equal(model.validateDocument(next, 'test'), false);
});

test('palette remaps distinct tones, preserves alpha and does not change pixels outside mask', () => {
  const src = image(8, 8);
  for (let i = 0; i < 64; i++) {
    src.data[i * 4] = i < 32 ? 220 : 40;
    src.data[i * 4 + 1] = i < 32 ? 60 : 180;
    src.data[i * 4 + 2] = 50;
  }
  const mask = new Uint8Array(64).fill(255);
  mask[0] = 0;
  const r = region(mask, 8, 8, {
    palette: { source: ['#dc3c32', '#28b432'], target: ['#2255cc', '#cc8855'] },
  });
  const out = pixels.adjustPixels(src, [r]);
  assert.deepEqual(out.data.slice(0, 4), src.data.slice(0, 4));
  assert.notDeepEqual(out.data.slice(4, 7), out.data.slice(160, 163));
  for (let i = 0; i < 64; i++) assert.equal(out.data[i * 4 + 3], src.data[i * 4 + 3]);
});
test('sticker borders survive source edges without resampling and post-coloring corrections restore exactly', () => {
  const src = image(8, 8),
    sticker = { ...types.defaultEffect('sticker'), id: 'edge', radius: 3, amount: 0, smooth: 0 };
  const out = effects.renderPixels(src, [], [sticker]);
  assert.ok(out.width > src.width);
  const p = (out.width - src.width) / 2;
  assert.deepEqual(
    out.data.slice((p * out.width + p) * 4, (p * out.width + p) * 4 + 4),
    src.data.slice(0, 4),
  );
  assert.ok(out.data[(p * out.width + p - 2) * 4 + 3] > 0);
  const coloring = { ...types.defaultEffect('coloring'), id: 'lines' };
  const mask = new Uint8Array(64);
  mask[27] = 255;
  const erase = region(mask, 8, 8, { stage: 'after-effects', operation: 'erase' }),
    restore = { ...erase, id: 'restore', operation: 'restore' };
  assert.deepEqual(
    effects.renderPixels(src, [erase, restore], [coloring]),
    effects.renderPixels(src, [], [coloring]),
  );
});

test('SVG line tracing produces actual paths, retains holes, and rejects colored artwork', async () => {
  const { traceLineArt } = await loadTypescript('src/editor/smart/trace.ts');
  const src = image(12, 12);
  src.data.fill(255);
  for (let y = 2; y < 10; y++)
    for (let x = 2; x < 10; x++)
      if (x < 4 || x > 7 || y < 4 || y > 7)
        for (let c = 0; c < 3; c++) src.data[(y * 12 + x) * 4 + c] = 0;
  const result = traceLineArt(src);
  assert.ok(result.paths >= 2);
  assert.match(result.svg, /fill-rule="evenodd"/);
  assert.ok(!result.svg.includes('<image'));
  assert.equal(result.meanError, 0);
  for (let i = 0; i < src.data.length; i += 4) {
    src.data[i] = 210;
    src.data[i + 1] = 40;
    src.data[i + 2] = 80;
  }
  assert.throws(() => traceLineArt(src), /not clean monochrome/);
});

test('local image headers reject oversized and executable files before browser decoding', async () => {
  const { localImageHeader } = await loadTypescript('src/editor/smart/local-image.ts');
  assert.throws(
    () => localImageHeader(new TextEncoder().encode('<svg onload="bad()"/>')),
    /valid, still PNG/,
  );
  const png = new Uint8Array(33),
    view = new DataView(png.buffer);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  view.setUint32(8, 13);
  png.set(new TextEncoder().encode('IHDR'), 12);
  view.setUint32(16, 512);
  view.setUint32(20, 256);
  assert.deepEqual(localImageHeader(png), { width: 512, height: 256, mime: 'image/png' });
  view.setUint32(16, 999999);
  assert.throws(() => localImageHeader(png), /4096 pixels/);
});

function unfilter(bytes, width, height, channels) {
  const stride = width * channels,
    out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x,
        k = bytes[y * (stride + 1)],
        left = x >= channels ? out[i - channels] : 0,
        up = y ? out[i - stride] : 0,
        corner = y && x >= channels ? out[i - stride - channels] : 0,
        p = left + up - corner;
      const a = Math.abs(p - left),
        b = Math.abs(p - up),
        c = Math.abs(p - corner),
        paeth = a <= b && a <= c ? left : b <= c ? up : corner;
      out[i] =
        (bytes[y * (stride + 1) + 1 + x] + [0, left, up, Math.floor((left + up) / 2), paeth][k]) &
        255;
    }
  return out;
}
test('adaptive lossless PDF compression round-trips four-channel noise, gradients and transparency', async () => {
  const { predictRows } = await loadTypescript('src/editor/smart/predict.ts');
  for (const channels of [1, 4])
    for (const type of ['noise', 'gradient', 'zero']) {
      const w = 71,
        h = 37,
        raw = Uint8Array.from({ length: w * h * channels }, (_, i) =>
          type === 'zero'
            ? 0
            : type === 'gradient'
              ? Math.floor(i / (w * channels)) * 5
              : (Math.imul(i, 16777619) ^ Math.floor(i / 11)) & 255,
        );
      assert.deepEqual(unfilter(predictRows(raw, w, h, channels), w, h, channels), raw);
    }
});
