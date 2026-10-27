import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { previewIdentity, previewUrls, readPreviewIndex } from '../../scripts/preview-assets.mjs';

const root = resolve(import.meta.dirname, '../..');
const manifests = new Map();
export function readPublishedPage(item, kind) {
  assert.ok(['art', 'edit'].includes(kind));
  const staticPath = join(root, 'dist', kind, item.id, 'index.html');
  if (existsSync(staticPath)) return readFileSync(staticPath, 'utf8');

  const collection = item.sourceCollection;
  assert.match(collection, /^owner-[a-z0-9-]+$/);
  if (!manifests.has(collection)) {
    const home = readFileSync(join(root, 'dist/index.html'), 'utf8');
    const revision = home.match(/name="build-revision" content="([a-f0-9]{40})"/)?.[1];
    assert.ok(revision, 'Offloaded pages require a production revision');
    const path = join(root, 'work/catalog-pages', collection, revision, 'verified-manifest.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(manifest.status, 'verified');
    assert.equal(manifest.revision, revision);
    manifests.set(collection, manifest);
  }
  const entry = manifests
    .get(collection)
    .pages.find((page) => page.id === item.id && page.kind === kind);
  assert.ok(entry, `Missing verified ${kind} page: ${item.id}`);
  const body = readFileSync(
    join(
      root,
      'work/catalog-pages',
      collection,
      manifests.get(collection).revision,
      `${kind}-${item.id}.html`,
    ),
  );
  assert.equal(body.length, entry.bytes);
  assert.equal(createHash('sha256').update(body).digest('hex'), entry.sha256);
  return body.toString('utf8');
}

/** Assert the actual catalog image, not an incidental CDN string in bundled code. */
let publishedImages;
let previewIndex;
export function assertPublishedImage(item, html) {
  const production = process.env.CF_PAGES === '1';
  if (production)
    publishedImages ??= new Map(
      JSON.parse(readFileSync(join(root, 'data/publication.json'), 'utf8'))
        .files.filter((file) => file.kind === 'webp')
        .map((file) => [file.assetId, file.url]),
    );
  const source = production ? publishedImages.get(item.id) : item.webp;
  assert.ok(source, `Missing verified image for ${item.id}`);
  const detail = html.slice(html.indexOf('id="art-preview"'));
  const displayed = detail.match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1];
  const preview = previewUrls(item)[960];
  assert.ok(displayed === source || displayed === preview, `Wrong displayed image for ${item.id}`);
  if (displayed === preview) {
    previewIndex ??= readPreviewIndex(root);
    const metadata = previewIndex[previewIdentity(item)]?.files?.[960];
    assert.ok(metadata, `Missing source-bound preview record: ${item.id}`);
    const bytes = readFileSync(join(root, 'dist', preview));
    assert.equal(bytes.length, metadata.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.sha256);
  }
  const canonicalSource = new URL(source, 'https://ultraclipart.com').href;
  assert.ok(
    html.includes(`"contentUrl":"${canonicalSource}"`),
    `Wrong structured image URL for ${item.id}`,
  );
}
