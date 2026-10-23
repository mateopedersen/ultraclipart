#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, renameSync, realpathSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateBatch, HARD_CAP } from './plan.mjs';
import { objectIdentity, validateInventoryScope } from './inventory.mjs';
import {
  ASSET_ORIGIN,
  SITE_ORIGIN,
  MIME_TYPES,
  assetIdentity,
  catalogFiles,
  validateAssetUrl,
  validateManifest,
  validatePublication,
  validateLocalAssetPath,
} from '../publication-policy.mjs';
const sha = (body) => createHash('sha256').update(body).digest('hex');
const kindOf = (kind) => (kind === 'thumbnail' ? 'thumb' : kind);

function validateJournal(journal, batch, batchSha256) {
  if (
    !/^[a-f0-9]{64}$/.test(batchSha256 ?? '') ||
    journal?.schemaVersion !== 2 ||
    journal.status !== 'uploaded-and-byte-verified' ||
    journal.batchSha256 !== batchSha256 ||
    !Number.isFinite(Date.parse(journal.completedAt)) ||
    !Array.isArray(journal.verifiedObjects) ||
    !Array.isArray(journal.verifiedArtworkIds) ||
    !Number.isSafeInteger(journal.aggregateBytes) ||
    journal.aggregateBytes > HARD_CAP ||
    journal.aggregateBytes < 0
  )
    throw new Error('A successful matching all-scope upload journal is required');
  if (journal.aggregateBytes < batch.reduce((sum, object) => sum + object.bytes, 0))
    throw new Error('Upload journal aggregate is smaller than its verified objects');
  const scope = journal.inventoryScope;
  if (!scope || !Array.isArray(scope.jurisdictions))
    throw new Error('Upload journal is missing its inventory scope');
  validateInventoryScope({
    schemaVersion: 2,
    ...scope,
    buckets: scope.jurisdictions.flatMap((j) =>
      j.buckets.map((name) => ({ name, jurisdiction: j.jurisdiction })),
    ),
  });
  const verified = new Map(
    journal.verifiedObjects.map((object) => [objectIdentity(object), object]),
  );
  const artworkIds = [...new Set(batch.map((object) => object.assetId))].sort();
  if (
    verified.size !== batch.length ||
    verified.size !== journal.verifiedObjects.length ||
    JSON.stringify([...journal.verifiedArtworkIds].sort()) !== JSON.stringify(artworkIds)
  )
    throw new Error('Incomplete or duplicated upload journal');
  for (const object of batch) {
    const entry = verified.get(objectIdentity(object));
    if (!entry || entry.bytes !== object.bytes || entry.sha256 !== object.sha256)
      throw new Error('Upload journal checksum or size differs from the batch');
  }
}

async function verifiedCdnFile(file, fetcher, now) {
  validateAssetUrl(file);
  let response;
  try {
    response = await fetcher(file.url, {
      headers: { Origin: SITE_ORIGIN, 'Cache-Control': 'no-cache' },
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error(`CDN verification could not fetch ${file.assetId}/${file.kind}`);
  }
  if (response.status !== 200 || (response.url && response.url !== file.url))
    throw new Error(`CDN returned a redirect or non-200 response for ${file.assetId}/${file.kind}`);
  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  const corsOrigin = response.headers.get('access-control-allow-origin');
  if (contentType !== MIME_TYPES[file.kind] || ![SITE_ORIGIN, '*'].includes(corsOrigin))
    throw new Error(`CDN MIME or CORS mismatch for ${file.assetId}/${file.kind}`);
  const digest = createHash('sha256');
  let bytes = 0;
  if (!response.body) throw new Error('CDN returned an empty response body');
  const reader = response.body.getReader();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > file.bytes) {
        await reader.cancel();
        throw new Error(`CDN byte count exceeds catalog for ${file.assetId}/${file.kind}`);
      }
      digest.update(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (bytes !== file.bytes || digest.digest('hex') !== file.sha256)
    throw new Error(`CDN checksum or size mismatch for ${file.assetId}/${file.kind}`);
  return {
    ...file,
    contentType,
    corsOrigin,
    verifiedAt: new Date(now()).toISOString(),
    verification: 'cdn-get-sha256',
  };
}

/** Read-only publication preparation. Existing verified URLs are retained; only new bytes are fetched. */
export async function preparePublication({
  prior,
  catalog,
  batch,
  journal,
  batchSha256,
  readAsset,
  fetcher = fetch,
  now = Date.now,
}) {
  validateBatch(batch);
  if (new Set(batch.map((object) => object.assetId)).size > 50)
    throw new Error('At most 50 artworks per reviewed production wave');
  validateJournal(journal, batch, batchSha256);
  const previous = prior ? validateManifest(prior) : new Map();
  const expected = catalogFiles(catalog),
    expectedById = new Map(expected.map((file) => [assetIdentity(file.assetId, file.kind), file]));
  const uploaded = new Map();
  for (const object of batch) {
    const id = assetIdentity(object.assetId, kindOf(object.kind)),
      file = expectedById.get(id);
    if (!file || object.bytes !== file.bytes || object.sha256 !== file.sha256 || uploaded.has(id))
      throw new Error('Batch contains an unknown or mismatched catalog representation');
    uploaded.set(id, object);
  }
  // Preflight the full next catalog and all missing representations before any CDN request.
  const candidates = expected.map((file) => {
    const body = readAsset(file.path);
    if (body.length !== file.bytes || sha(body) !== file.sha256)
      throw new Error(`Local source differs from catalog: ${file.path}`);
    const id = assetIdentity(file.assetId, file.kind),
      old = previous.get(id);
    if (
      old &&
      old.path === file.path &&
      old.name === file.name &&
      old.bytes === file.bytes &&
      old.sha256 === file.sha256
    )
      return { retained: old };
    const object = uploaded.get(id);
    if (!object)
      throw new Error(
        `Incomplete next publication: ${id} has no verified prior URL or uploaded representation`,
      );
    return { fresh: { ...file, url: `${ASSET_ORIGIN}/${object.key}` } };
  });
  const files = [];
  for (const candidate of candidates)
    files.push(candidate.retained ?? (await verifiedCdnFile(candidate.fresh, fetcher, now)));
  const manifest = {
    schema: 2,
    status: 'verified',
    verifiedAt: new Date(now()).toISOString(),
    files,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
  };
  validatePublication(manifest, catalog, readAsset);
  return manifest;
}

async function main() {
  const root = resolve(import.meta.dirname, '../..'),
    args = process.argv.slice(2);
  const usage =
    'node scripts/r2/prepare-publication.mjs --batch work/r2-batch.json --journal r2-ingest-journal.json [--prior data/publication.json | --initial] [--output work/publication.next.json]';
  if (args.includes('--help')) {
    console.log(usage);
    return;
  }
  const options = {
    prior: resolve(root, 'data/publication.json'),
    output: resolve(root, 'work/publication.next.json'),
  };
  while (args.length) {
    const flag = args.shift();
    if (flag === '--initial') options.prior = null;
    else if (
      ['--batch', '--journal', '--prior', '--output'].includes(flag) &&
      args[0] &&
      !args[0].startsWith('--')
    )
      options[flag.slice(2)] = resolve(args.shift());
    else throw new Error(usage);
  }
  if (!options.batch || !options.journal) throw new Error(usage);
  if ([options.batch, options.journal, options.prior].filter(Boolean).includes(options.output))
    throw new Error('Write a separate reviewable next manifest; do not overwrite an input');
  const rawBatch = readFileSync(options.batch),
    readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
  const publicRoot = realpathSync(join(root, 'public'));
  const manifest = await preparePublication({
    prior: options.prior ? readJson(options.prior) : null,
    catalog: readJson(join(root, 'data/art.json')),
    batch: JSON.parse(rawBatch),
    journal: readJson(options.journal),
    batchSha256: sha(rawBatch),
    readAsset: (path) => {
      const file = realpathSync(join(publicRoot, validateLocalAssetPath(path)));
      if (!file.startsWith(`${publicRoot}/`)) throw new Error('Source symlink escapes public/');
      return readFileSync(file);
    },
  });
  mkdirSync(dirname(options.output), { recursive: true });
  const temp = `${options.output}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
  renameSync(temp, options.output);
  console.log(
    JSON.stringify(
      {
        output: options.output,
        files: manifest.files.length,
        bytes: manifest.bytes,
        artworks: manifest.files.length / 4,
        remoteWrites: 0,
        editorialApproval: 'unchanged; requires separate review',
      },
      null,
      2,
    ),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
