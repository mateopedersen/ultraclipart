import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleSubject } from '../scripts/supplied-metadata.mjs';

test('supplied metadata leaves readable sentences when negative constraints are removed', () => {
  assert.equal(
    visibleSubject(
      'One spotted baby deer fawn sitting gently with no antlers, illustrated in delicate luminous watercolor. | CMYK print artwork | 300 pixels per inch at native size',
    ),
    'A spotted baby deer fawn sitting gently.',
  );
  assert.equal(
    visibleSubject(
      'One hand-painted ceramic bee figurine with delicate small floral painted accents, whole animal and no pedestal in glazed ceramic illustration.',
    ),
    'A ceramic bee figurine with delicate small floral painted accents.',
  );
  assert.equal(visibleSubject('One adorable dolphin calf.'), 'An adorable dolphin calf.');
  assert.equal(
    visibleSubject('One owl beside a small habitat-appropriate leaf or coral sprig.'),
    'An owl beside a small decorative sprig.',
  );
  assert.equal(
    visibleSubject('Golden yellow and black bee in flight, isolated on a transparent background.'),
    'Golden yellow and black bee in flight.',
  );
});
