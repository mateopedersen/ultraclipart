import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateIdentification } from '../scripts/identification-review.mjs';

const sourceBytes = Buffer.from('reviewed source image bytes');
const artwork = {
  id: 'review-case',
  title: 'Labubu Reading',
  alt: 'Labubu holding an open book.',
  description: 'Labubu seated with a blue book.',
};
const valid = () => ({
  id: artwork.id,
  status: 'PASS',
  identity: 'Labubu',
  level: 'character-family',
  source: 'work/production/review-case.png',
  manufacturerDomains: ['popmart.com'],
  brand: 'THE MONSTERS',
  sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
  reviewedAt: '2026-10-25T18:00:00Z',
  observedFeatures: ['Long upright ears', 'Serrated grin'],
  officialSources: [
    {
      url: 'https://www.popmart.com/us/collection/the-monsters',
      publisher: 'POP MART',
      kind: 'official',
    },
  ],
  metadata: { title: artwork.title, alt: artwork.alt, description: artwork.description },
});
test('review is bound to inspected bytes and exact public metadata', () => {
  assert.equal(
    validateIdentification({ artwork, sourceBytes, record: valid() }).identity,
    'Labubu',
  );
  assert.throws(
    () =>
      validateIdentification({ artwork, sourceBytes: Buffer.from('replacement'), record: valid() }),
    /source changed/,
  );
  assert.throws(
    () =>
      validateIdentification({
        artwork: { ...artwork, alt: 'Labubu with an invented model.' },
        sourceBytes,
        record: valid(),
      }),
    /unreviewed alt/,
  );
});
test('missing approval, observations or official sources prevent identity reuse', () => {
  assert.throws(
    () => validateIdentification({ artwork, sourceBytes, record: null }),
    /missing approval/,
  );
  for (const changes of [
    { status: 'PENDING' },
    { observedFeatures: [] },
    { officialSources: [] },
    { reviewedAt: 'unknown' },
    { officialSources: [{ url: 'http://example.com', publisher: 'Example', kind: 'official' }] },
  ]) {
    assert.throws(() =>
      validateIdentification({ artwork, sourceBytes, record: { ...valid(), ...changes } }),
    );
  }
});
test('speculative designs must be explicitly identified as concepts', () => {
  assert.throws(
    () =>
      validateIdentification({
        artwork,
        sourceBytes,
        record: { ...valid(), level: 'imagined-concept' },
      }),
    /concept not identified/,
  );
});
