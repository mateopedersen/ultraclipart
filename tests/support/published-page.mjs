import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

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
