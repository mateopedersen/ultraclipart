import {
  JURISDICTIONS,
  jurisdictionOf,
  bucketIdentity,
  objectIdentity,
  validateInventoryScope,
} from './inventory.mjs';
import { sourceTypeOf, representationKinds } from '../asset-representations.mjs';
export const HARD_CAP = 10_000_000_000_000;
export const PDF_CAP = 1_000_000;
export function enforceStorageBudget(plan, byteBudget = HARD_CAP) {
  if (!Number.isSafeInteger(byteBudget) || byteBudget <= 0 || byteBudget > HARD_CAP)
    throw new Error('Invalid account storage budget');
  if (!Number.isSafeInteger(plan.projectedBytes) || plan.projectedBytes > byteBudget)
    throw new Error(`Batch would exceed the configured ${byteBudget}-byte account storage budget`);
  return plan;
}
const representations = ['pdf', 'svg', 'thumbnail', 'webp'];

function natural(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${field}`);
  return value;
}

export function validateBatch(batch) {
  if (!Array.isArray(batch) || batch.length === 0)
    throw new Error('Batch must contain complete artwork groups');
  const keys = new Set();
  const groups = new Map();
  for (const object of batch) {
    if (
      !object ||
      !JURISDICTIONS.includes(jurisdictionOf(object)) ||
      !/^[a-z0-9][a-z0-9-]+$/.test(object.bucket ?? '')
    )
      throw new Error('Invalid bucket');
    if (!/^[a-zA-Z0-9][a-zA-Z0-9/_\-.]+$/.test(object.key ?? '') || object.key.includes('..'))
      throw new Error('Invalid object key');
    if (!/^[a-f0-9]{64}$/.test(object.sha256 ?? '')) throw new Error('Missing SHA256');
    if (!object.key.includes(object.sha256.slice(0, 12)))
      throw new Error('Object key must contain its content hash');
    if (!object.assetId || !representations.includes(object.kind))
      throw new Error('Missing artwork identity or representation');
    if (natural(object.bytes, 'object bytes') === 0) throw new Error('Empty representation');
    if (object.kind === 'pdf' && object.bytes > PDF_CAP)
      throw new Error('PDF exceeds 1,000,000 bytes');
    const identity = objectIdentity(object);
    if (keys.has(identity)) throw new Error('Duplicate object key');
    keys.add(identity);
    const sourceType = sourceTypeOf(object);
    const group = groups.get(object.assetId) ?? { sourceType, kinds: [] };
    if (sourceType !== group.sourceType) throw new Error('Mixed artwork source types');
    group.kinds.push(object.kind);
    groups.set(object.assetId, group);
  }
  for (const [id, group] of groups) {
    const required = representationKinds(group).map((kind) =>
      kind === 'thumb' ? 'thumbnail' : kind,
    );
    if (group.kinds.sort().join(',') !== required.sort().join(','))
      throw new Error(
        `Artwork ${id} requires exactly its declared representations (PDF, WebP, thumbnail and SVG for layered artwork)`,
      );
  }
  return batch;
}

export function buildPlan(inventory, batch, now = Date.now()) {
  validateBatch(batch);
  if (
    !inventory ||
    inventory.complete !== true ||
    !Array.isArray(inventory.buckets) ||
    inventory.buckets.length === 0
  )
    throw new Error('Unknown aggregate occupancy');
  validateInventoryScope(inventory);
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(inventory.observedAt) ||
    inventory.observedAt > now ||
    now - inventory.observedAt > 60_000
  )
    throw new Error('Stale or unknown inventory time');
  const observed = new Set();
  const existing = new Map();
  let total = 0;
  for (const bucket of inventory.buckets) {
    const scopedBucket = bucketIdentity(bucket.name, jurisdictionOf(bucket));
    if (
      !bucket.name ||
      observed.has(scopedBucket) ||
      bucket.complete !== true ||
      !Array.isArray(bucket.objects)
    )
      throw new Error('Incomplete or duplicate bucket inventory');
    observed.add(scopedBucket);
    for (const object of bucket.objects) {
      const id = `${scopedBucket}/${object.key}`;
      if (!object.key || existing.has(id)) throw new Error('Duplicate or invalid inventory object');
      total = natural(total + natural(object.bytes, 'inventory bytes'), 'aggregate bytes');
      existing.set(id, object);
    }
  }
  if (total > HARD_CAP) throw new Error('Existing occupancy already exceeds hard cap');
  const upload = [];
  const verify = [];
  for (const object of batch) {
    if (!observed.has(bucketIdentity(object.bucket, jurisdictionOf(object))))
      throw new Error('Target bucket missing from measured inventory');
    const old = existing.get(objectIdentity(object));
    if (old) {
      if (old.bytes !== object.bytes || old.sha256 !== object.sha256)
        throw new Error('Existing content hash key has unknown or conflicting content');
      verify.push(object);
    } else upload.push(object);
  }
  const additionalBytes = natural(
    upload.reduce((sum, object) => sum + object.bytes, 0),
    'batch bytes',
  );
  const projectedBytes = natural(total + additionalBytes, 'projected bytes');
  if (projectedBytes > HARD_CAP)
    throw new Error('Batch would exceed 10,000,000,000,000-byte hard cap');
  return {
    measuredBytes: total,
    additionalBytes,
    projectedBytes,
    hardCapBytes: HARD_CAP,
    warning:
      projectedBytes >= 9_500_000_000_000
        ? 'APPROACHING_STORAGE_CAP'
        : projectedBytes >= 8_000_000_000_000
          ? 'REVIEW_STORAGE'
          : null,
    upload,
    verify,
    artworkIds: [...new Set(batch.map((object) => object.assetId))],
  };
}
