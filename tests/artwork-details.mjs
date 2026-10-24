import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTypescript } from './helpers/typescript.mjs';
const { artworkDetails, formatFileSize } = await loadTypescript('src/lib/artwork-details.ts');
const catalog = JSON.parse(readFileSync('data/art.json', 'utf8'));

test('every published artwork has readable facts without inventing AI provenance or vector layers', () => {
  for (const item of catalog) {
    const facts = artworkDetails(item);
    assert.ok(facts.style && facts.origin, item.id);
    assert.equal(facts.aiGenerated, item.productionMethod === 'generated-raster', item.id);
    assert.match(facts.printInches, /^\d+\.\d{2} × \d+\.\d{2} in$/, item.id);
    if (item.sourceType === 'raster') assert.match(facts.editing, /one image layer/, item.id);
    if (item.productionMethod === 'owner-supplied')
      assert.doesNotMatch(facts.origin, /AI-generated/);
  }
});

test('print guidance describes the full raster canvas at 300 ppi, including portrait and landscape', () => {
  const landscape = artworkDetails({ id: 'example', style: 'Color', width: 1800, height: 1200 });
  assert.equal(landscape.orientation, 'Landscape');
  assert.equal(landscape.printInches, '6.00 × 4.00 in');
  assert.equal(landscape.printCentimeters, '15.2 × 10.2 cm');
  assert.equal(
    artworkDetails({ id: 'sample-watercolor', style: 'Color', width: 900, height: 1200 }).style,
    'Watercolor',
  );
  assert.equal(
    artworkDetails({ id: 'sample', style: 'Color', width: 900, height: 1200 }).orientation,
    'Portrait',
  );
});

test('file sizes use honest binary units with safe missing-data handling', () => {
  assert.equal(formatFileSize(441044), '431 KiB');
  assert.equal(formatFileSize(1024 * 1024), '1.00 MiB');
  assert.equal(formatFileSize(500), '500 B');
  assert.equal(formatFileSize(NaN), 'Size unavailable');
});
