export const HARD_CAP = 8_000_000_000;
export const PDF_CAP = 1_000_000;
const representations = ['pdf', 'svg', 'thumbnail', 'webp'];

function natural(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${field}`);
  return value;
}

export function validateBatch(batch) {
  if (!Array.isArray(batch) || batch.length === 0) throw new Error('Batch must contain complete artwork groups');
  const keys = new Set();
  const groups = new Map();
  for (const object of batch) {
    if (!object || !/^[a-z0-9][a-z0-9-]+$/.test(object.bucket ?? '')) throw new Error('Invalid bucket');
    if (!/^[a-zA-Z0-9][a-zA-Z0-9/_\-.]+$/.test(object.key ?? '') || object.key.includes('..')) throw new Error('Invalid object key');
    if (!/^[a-f0-9]{64}$/.test(object.sha256 ?? '')) throw new Error('Missing SHA256');
    if (!object.key.includes(object.sha256.slice(0, 12))) throw new Error('Object key must contain its content hash');
    if (!object.assetId || !representations.includes(object.kind)) throw new Error('Missing artwork identity or representation');
    if (natural(object.bytes, 'object bytes') === 0) throw new Error('Empty representation');
    if (object.kind === 'pdf' && object.bytes > PDF_CAP) throw new Error('PDF exceeds 1,000,000 bytes');
    const identity = `${object.bucket}/${object.key}`;
    if (keys.has(identity)) throw new Error('Duplicate object key');
    keys.add(identity);
    const group = groups.get(object.assetId) ?? [];
    group.push(object.kind);
    groups.set(object.assetId, group);
  }
  for (const [id, kinds] of groups) {
    if (kinds.sort().join(',') !== representations.join(',')) throw new Error(`Artwork ${id} requires exactly PDF, SVG, thumbnail and WebP`);
  }
  return batch;
}

export function buildPlan(inventory, batch, now = Date.now()) {
  validateBatch(batch);
  if (!inventory || inventory.complete !== true || !Array.isArray(inventory.buckets) || inventory.buckets.length === 0) throw new Error('Unknown aggregate occupancy');
  if (!Number.isFinite(now) || !Number.isFinite(inventory.observedAt) || inventory.observedAt > now || now - inventory.observedAt > 60_000) throw new Error('Stale or unknown inventory time');
  const observed = new Set();
  const existing = new Map();
  let total = 0;
  for (const bucket of inventory.buckets) {
    if (!bucket.name || observed.has(bucket.name) || bucket.complete !== true || !Array.isArray(bucket.objects)) throw new Error('Incomplete or duplicate bucket inventory');
    observed.add(bucket.name);
    for (const object of bucket.objects) {
      const id = `${bucket.name}/${object.key}`;
      if (!object.key || existing.has(id)) throw new Error('Duplicate or invalid inventory object');
      total = natural(total + natural(object.bytes, 'inventory bytes'), 'aggregate bytes');
      existing.set(id, object);
    }
  }
  if (total > HARD_CAP) throw new Error('Existing occupancy already exceeds hard cap');
  const upload = [];
  const verify = [];
  for (const object of batch) {
    if (!observed.has(object.bucket)) throw new Error('Target bucket missing from measured inventory');
    const old = existing.get(`${object.bucket}/${object.key}`);
    if (old) {
      if (old.bytes !== object.bytes || old.sha256 !== object.sha256) throw new Error('Existing content hash key has unknown or conflicting content');
      verify.push(object);
    } else upload.push(object);
  }
  const additionalBytes = natural(upload.reduce((sum, object) => sum + object.bytes, 0), 'batch bytes');
  const projectedBytes = natural(total + additionalBytes, 'projected bytes');
  if (projectedBytes > HARD_CAP) throw new Error('Batch would exceed 8,000,000,000-byte hard cap');
  return {
    measuredBytes: total,
    additionalBytes,
    projectedBytes,
    hardCapBytes: HARD_CAP,
    warning: projectedBytes >= 7_500_000_000 ? 'STOP_NONESSENTIAL_OBJECTS' : projectedBytes >= 6_500_000_000 ? 'REVIEW_STORAGE' : null,
    upload,
    verify,
    artworkIds: [...new Set(batch.map(object => object.assetId))],
  };
}
