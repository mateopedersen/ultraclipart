import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { basename, join, posix } from 'node:path';
import {
  sourceTypeOf,
  representationKinds,
  validateEditorSource,
} from './asset-representations.mjs';

export const ASSET_ORIGIN = 'https://assets.ultraclipart.com';
export const SITE_ORIGIN = 'https://ultraclipart.com';
export const ASSET_KINDS = Object.freeze(['svg', 'webp', 'pdf', 'thumb']);
export const MIME_TYPES = Object.freeze({
  svg: 'image/svg+xml',
  webp: 'image/webp',
  pdf: 'application/pdf',
  thumb: 'image/webp',
});
export const assetIdentity = (assetId, kind) => `${assetId}/${kind}`;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function validateLocalAssetPath(path) {
  if (
    typeof path !== 'string' ||
    !/^\/[A-Za-z0-9][A-Za-z0-9/_\-.]+$/.test(path) ||
    path.includes('..') ||
    posix.normalize(path) !== path ||
    path.endsWith('/')
  )
    throw new Error('Asset path must be normalized within public/');
  return path;
}
export function validateAssetUrl(file) {
  let url;
  try {
    url = new URL(file.url);
  } catch {
    throw new Error('Invalid publication URL');
  }
  if (
    url.origin !== ASSET_ORIGIN ||
    url.href !== file.url ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/[A-Za-z0-9][A-Za-z0-9/_\-.]+$/.test(url.pathname) ||
    url.pathname.includes('..') ||
    url.pathname.includes('//')
  )
    throw new Error(
      'Publication URL must use the approved HTTPS asset origin and a normalized immutable path',
    );
  const extension = file.kind === 'thumb' ? 'webp' : file.kind;
  if (!url.pathname.endsWith(`.${extension}`))
    throw new Error('Publication URL extension differs from its representation');
  const legacySnapshot = /^\/pilot-[a-f0-9]{12}\/[a-z0-9-]+\.(?:svg|webp|pdf)$/.test(url.pathname);
  const keyHash = /\.([a-f0-9]{12,64})\.[a-z]+$/.exec(url.pathname)?.[1];
  const contentAddressed = keyHash && file.sha256.startsWith(keyHash);
  if (!legacySnapshot && !contentAddressed)
    throw new Error(
      'Publication URL must identify an immutable snapshot or its verified content hash',
    );
  return file.url;
}

/** Validate a prior verified manifest without requiring its historical files to remain local. */
export function validateManifest(manifest) {
  if (
    manifest?.schema !== 2 ||
    manifest.status !== 'verified' ||
    !Array.isArray(manifest.files) ||
    !Number.isFinite(Date.parse(manifest.verifiedAt))
  )
    throw new Error('Production requires a verified per-file publication manifest');
  const files = new Map(),
    paths = new Set(),
    urls = new Set(),
    groups = new Map();
  let bytes = 0;
  for (const file of manifest.files) {
    if (
      !/^[a-z0-9][a-z0-9-]+$/.test(file.assetId ?? '') ||
      !ASSET_KINDS.includes(file.kind) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes <= 0 ||
      !/^[a-f0-9]{64}$/.test(file.sha256 ?? '')
    )
      throw new Error('Invalid publication file identity, bytes or checksum');
    validateLocalAssetPath(file.path);
    if (
      file.name !== basename(file.path) ||
      !file.path.endsWith(`.${file.kind === 'thumb' ? 'webp' : file.kind}`)
    )
      throw new Error('Publication local filename or extension differs');
    validateAssetUrl(file);
    if (
      file.contentType !== MIME_TYPES[file.kind] ||
      ![SITE_ORIGIN, '*'].includes(file.corsOrigin) ||
      !Number.isFinite(Date.parse(file.verifiedAt)) ||
      file.verification !== 'cdn-get-sha256'
    )
      throw new Error('Missing CDN hash, MIME or CORS verification metadata');
    const id = assetIdentity(file.assetId, file.kind);
    if (files.has(id) || paths.has(file.path) || urls.has(file.url))
      throw new Error('Duplicate publication identity, local path or URL');
    if (file.kind === 'pdf' && file.bytes > 1_000_000)
      throw new Error('Standard PDF exceeds its byte ceiling');
    files.set(id, file);
    paths.add(file.path);
    urls.add(file.url);
    bytes += file.bytes;
    const sourceType = sourceTypeOf(file);
    const group = groups.get(file.assetId) ?? { sourceType, kinds: [] };
    if (group.sourceType !== sourceType) throw new Error('Mixed source types within artwork');
    group.kinds.push(file.kind);
    groups.set(file.assetId, group);
  }
  if (
    [...groups.values()].some(
      (group) => [...group.kinds].sort().join(',') !== representationKinds(group).sort().join(','),
    )
  )
    throw new Error('Publication contains an incomplete artwork');
  if (!Number.isSafeInteger(bytes) || manifest.bytes !== bytes)
    throw new Error('Publication byte total differs');
  return files;
}

export function catalogFiles(catalog) {
  if (!Array.isArray(catalog) || !catalog.length)
    throw new Error('Publication requires a nonempty catalog');
  const ids = new Set(),
    paths = new Set();
  return catalog.flatMap((item) => {
    if (!/^[a-z0-9][a-z0-9-]+$/.test(item.id ?? '') || ids.has(item.id))
      throw new Error('Invalid or duplicate catalog artwork ID');
    ids.add(item.id);
    const sourceType = validateEditorSource(item);
    if (sourceType === 'raster' && (item.svg != null || item.files?.svg != null))
      throw new Error('Raster artwork must not advertise a fabricated SVG source');
    return representationKinds(item).map((kind) => {
      const path = validateLocalAssetPath(item[kind]),
        metadata = item.files?.[kind];
      if (paths.has(path)) throw new Error('Catalog representations must have unique source paths');
      paths.add(path);
      if (
        !metadata ||
        !Number.isSafeInteger(metadata.bytes) ||
        metadata.bytes <= 0 ||
        !/^[a-f0-9]{64}$/.test(metadata.sha256 ?? '')
      )
        throw new Error('Missing catalog asset metadata');
      return {
        assetId: item.id,
        ...(sourceType === 'raster' ? { sourceType } : {}),
        kind,
        path,
        name: basename(path),
        bytes: metadata.bytes,
        sha256: metadata.sha256,
      };
    });
  });
}

/** Reject incomplete or stale releases before any production HTML is generated. */
export function validatePublication(manifest, catalog, readAsset) {
  const files = validateManifest(manifest),
    expected = catalogFiles(catalog);
  if (files.size !== expected.length)
    throw new Error('Publication file count differs from the catalog');
  const assetUrls = Object.fromEntries(catalog.map((item) => [item.id, {}]));
  for (const asset of expected) {
    const file = files.get(assetIdentity(asset.assetId, asset.kind));
    if (
      !file ||
      sourceTypeOf(file) !== sourceTypeOf(asset) ||
      file.path !== asset.path ||
      file.name !== asset.name ||
      file.bytes !== asset.bytes ||
      file.sha256 !== asset.sha256
    )
      throw new Error(`Unverified catalog asset: ${asset.assetId}/${asset.kind}`);
    const body = readAsset(asset.path);
    if (body.length !== file.bytes || hash(body) !== file.sha256)
      throw new Error(`Source changed after CDN verification: ${file.path}`);
    assetUrls[asset.assetId] ??= {};
    assetUrls[asset.assetId][asset.kind] = file.url;
  }
  return {
    assetUrls,
    urls: [...files.values()].map((file) => file.url),
    localPaths: expected.map((file) => file.path),
    files: files.size,
    bytes: manifest.bytes,
  };
}

export function readPublication(root) {
  const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
  const publicRoot = realpathSync(join(root, 'public'));
  return validatePublication(
    readJson('data/publication.json'),
    readJson('data/art.json'),
    (path) => {
      const file = realpathSync(join(publicRoot, validateLocalAssetPath(path)));
      if (!file.startsWith(`${publicRoot}/`)) throw new Error('Source symlink escapes public/');
      return readFileSync(file);
    },
  );
}
