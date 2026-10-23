import { createHash } from 'node:crypto';
import {
  ASSET_KINDS,
  ASSET_ORIGIN,
  MIME_TYPES,
  SITE_ORIGIN,
} from '../../scripts/publication-policy.mjs';
import { JURISDICTIONS, SCOPE_VERSION, endpointFor } from '../../scripts/r2/inventory.mjs';
export const digest = (body) => createHash('sha256').update(body).digest('hex');
export const date = '2026-10-23T00:00:00Z';
export function artwork(id, bodies) {
  const item = { id, files: {} };
  for (const kind of ASSET_KINDS) {
    const name = `${id}${kind === 'thumb' ? '-thumb' : ''}.${kind === 'thumb' ? 'webp' : kind}`,
      path = `/pilot/${name}`,
      body = Buffer.from(`${id} verified ${kind} payload`);
    bodies.set(path, body);
    item[kind] = path;
    item.files[kind] = { bytes: body.length, sha256: digest(body) };
  }
  return item;
}
export function manifestFor(catalog) {
  const files = catalog.flatMap((item) =>
    ASSET_KINDS.map((kind) => ({
      assetId: item.id,
      kind,
      path: item[kind],
      name: item[kind].split('/').pop(),
      url: `${ASSET_ORIGIN}/pilot-123456abcdef/${item[kind].split('/').pop()}`,
      ...item.files[kind],
      contentType: MIME_TYPES[kind],
      corsOrigin: SITE_ORIGIN,
      verifiedAt: date,
      verification: 'cdn-get-sha256',
    })),
  );
  return {
    schema: 2,
    status: 'verified',
    verifiedAt: date,
    files,
    bytes: files.reduce((sum, f) => sum + f.bytes, 0),
  };
}
export function waveFor(catalog) {
  const batch = catalog.flatMap((item) =>
    ASSET_KINDS.map((field) => {
      const kind = field === 'thumb' ? 'thumbnail' : field,
        { bytes, sha256 } = item.files[field];
      return {
        assetId: item.id,
        kind,
        bucket: 'ultraclipart',
        jurisdiction: 'default',
        key: `topic/${item.id}.${kind}.${sha256.slice(0, 16)}.${field === 'thumb' ? 'webp' : field}`,
        path: `public${item[field]}`,
        bytes,
        sha256,
      };
    }),
  );
  const batchSha256 = digest(Buffer.from(JSON.stringify(batch)));
  const accountId = 'a'.repeat(32);
  const journal = {
    schemaVersion: 2,
    status: 'uploaded-and-byte-verified',
    batchSha256,
    completedAt: date,
    publishApproved: false,
    aggregateBytes: batch.reduce((sum, x) => sum + x.bytes, 0),
    verifiedArtworkIds: catalog.map((x) => x.id),
    verifiedObjects: batch.map(({ bucket, jurisdiction, key, sha256, bytes }) => ({
      bucket,
      jurisdiction,
      key,
      sha256,
      bytes,
    })),
    inventoryScope: {
      accountId,
      scopeVersion: SCOPE_VERSION,
      observedAt: Date.parse(date),
      jurisdictions: JURISDICTIONS.map((jurisdiction) => ({
        jurisdiction,
        endpoint: endpointFor(accountId, jurisdiction),
        complete: true,
        buckets: jurisdiction === 'default' ? ['ultraclipart'] : [],
        proof: { source: 's3-list-buckets' },
      })),
    },
  };
  return { batch, batchSha256, journal };
}
