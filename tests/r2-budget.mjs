import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, HARD_CAP, validateBatch } from '../scripts/r2/plan.mjs';
import { JURISDICTIONS, SCOPE_VERSION, endpointFor } from '../scripts/r2/inventory.mjs';

const now = 1_000_000;
const sha256 = 'a'.repeat(64);
const batch = ['pdf', 'svg', 'thumbnail', 'webp'].map((kind) => ({
  assetId: 'pumpkin-001',
  kind,
  bucket: 'ultraclipart',
  key: `pumpkin/${kind}.${sha256.slice(0, 12)}.${kind === 'thumbnail' ? 'webp' : kind}`,
  sha256,
  bytes: 100,
}));
function inventory(bytes = 0) {
  const accountId = 'a'.repeat(32);
  return {
    schemaVersion: 2,
    scopeVersion: SCOPE_VERSION,
    accountId,
    jurisdictions: JURISDICTIONS.map((jurisdiction) => ({
      jurisdiction,
      endpoint: endpointFor(accountId, jurisdiction),
      complete: true,
      buckets: jurisdiction === 'default' ? ['ultraclipart'] : [],
      proof: { source: 's3-list-buckets' },
    })),
    complete: true,
    observedAt: now,
    buckets: [
      {
        name: 'ultraclipart',
        complete: true,
        objects: bytes !== 0 ? [{ key: 'other/existing', bytes }] : [],
      },
    ],
  };
}

test('allows exactly the hard cap but rejects one byte over', () => {
  assert.equal(buildPlan(inventory(HARD_CAP - 400), batch, now).projectedBytes, HARD_CAP);
  assert.throws(() => buildPlan(inventory(HARD_CAP - 399), batch, now), /hard cap/);
});
test('counts all inventoried buckets, including unrelated existing objects', () => {
  const source = inventory();
  source.jurisdictions[0].buckets.push('another-production-bucket');
  source.buckets.push({
    name: 'another-production-bucket',
    complete: true,
    objects: [{ key: 'legacy.pdf', bytes: HARD_CAP - 399 }],
  });
  assert.throws(() => buildPlan(source, batch, now), /hard cap/);
});
test('fails closed for unknown, partial, stale and invalid occupancy', () => {
  for (const source of [
    null,
    {},
    { ...inventory(), complete: false },
    { ...inventory(), observedAt: now - 60_001 },
    { ...inventory(), observedAt: now + 1 },
    inventory(-1),
    inventory(NaN),
    inventory(Number.MAX_SAFE_INTEGER + 1),
  ]) {
    assert.throws(() => buildPlan(source, batch, now));
  }
  const partial = inventory();
  partial.buckets[0].complete = false;
  assert.throws(() => buildPlan(partial, batch, now), /Incomplete/);
});
test('resume skips upload only when stored size and checksum match', () => {
  const source = inventory();
  source.buckets[0].objects = batch.map((object) => ({ ...object }));
  const plan = buildPlan(source, batch, now);
  assert.equal(plan.upload.length, 0);
  assert.equal(plan.verify.length, 4);
  assert.equal(plan.additionalBytes, 0);
  delete source.buckets[0].objects[0].sha256;
  assert.throws(() => buildPlan(source, batch, now), /unknown or conflicting/);
});
test('rejects missing representations, duplicate keys, oversized PDF and unsafe object names', () => {
  assert.throws(() => validateBatch(batch.slice(1)), /exactly/);
  assert.throws(() => validateBatch([...batch, batch[0]]), /Duplicate/);
  assert.throws(
    () => validateBatch([{ ...batch[0], bytes: 1_000_001 }, ...batch.slice(1)]),
    /PDF exceeds/,
  );
  assert.throws(
    () => validateBatch([{ ...batch[0], key: '../bad' }, ...batch.slice(1)]),
    /Invalid object key/,
  );
});
test('rejects a target bucket absent from inventory and flags early warnings', () => {
  assert.throws(
    () =>
      buildPlan(
        inventory(),
        batch.map((object) => ({ ...object, bucket: 'unmeasured' })),
        now,
      ),
    /missing/,
  );
  assert.equal(buildPlan(inventory(6_500_000_000), batch, now).warning, 'REVIEW_STORAGE');
  assert.equal(
    buildPlan(inventory(7_500_000_000), batch, now).warning,
    'STOP_NONESSENTIAL_OBJECTS',
  );
});
