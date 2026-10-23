import test from 'node:test';
import assert from 'node:assert/strict';
import { rasterPlacement } from '../src/editor/raster-placement.ts';
import { paperLayout } from '../src/editor/pdf-math.ts';

test('PDF placement maps image corners through rotation, unequal scaling and crop without mirroring', () => {
  const doc = {
    width: 1600,
    height: 1000,
    crop: { x: 50, y: 70, width: 1200, height: 800 },
    print: { paper: 'letter', orientation: 'portrait', margin: 0.5, scale: 'fit' },
  };
  const layer = { width: 1000, height: 600, x: 140, y: 160, scaleX: 0.7, scaleY: 0.4, angle: 90 };
  const [a, b, c, d, e, f] = rasterPlacement(doc, layer, 240, 144);
  const map = (x, y) => [a * x + c * y + e, b * x + d * y + f];
  const p = paperLayout(doc),
    left = p.x + (140 - 50) * p.scale,
    top = p.pageHeight - p.y - (160 - 70) * p.scale;
  const near = (actual, expected) =>
    actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-8));
  near(map(0, 144), [left, top]);
  near(map(240, 144), [left, top - 700 * p.scale]);
  near(map(0, 0), [left - 240 * p.scale, top]);
  layer.angle = 0;
  const m = rasterPlacement(doc, layer, 240, 144);
  near([m[0] * 240 + m[4], m[3] * 144 + m[5]], [left + 700 * p.scale, top]);
});
