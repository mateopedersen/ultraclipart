import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruneVerifiedCatalogPages } from '../scripts/catalog-pages/prune.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const revision = 'a'.repeat(40);
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'catalog-pages-'));
  const dist = join(root, 'dist');
  const art = [{ id: 'book-reading', sourceCollection: 'owner-book-pack' }];
  const pages = ['art', 'edit'].map((kind) => {
    const path = join(dist, kind, art[0].id, 'index.html');
    mkdirSync(join(dist, kind, art[0].id), { recursive: true });
    const bytes = Buffer.from(`<h1>${kind} book</h1>`);
    writeFileSync(path, bytes);
    return {
      id: art[0].id,
      kind,
      key: `html/${revision}/${kind}/${art[0].id}/index.html`,
      bytes: bytes.length,
      sha256: sha(bytes),
      path,
    };
  });
  const manifestPath = join(root, 'manifest.json');
  const manifest = {
    schema: 1,
    status: 'verified',
    collection: 'owner-book-pack',
    revision,
    bucket: 'ultraclipart-pages',
    count: 1,
    pageCount: 2,
    pages: pages.map(({ path, ...page }) => page),
  };
  const save = () => writeFileSync(manifestPath, JSON.stringify(manifest));
  save();
  return { dist, art, pages, manifest, manifestPath, save };
}

test('only a fully verified art/editor pair is removed from Pages output', () => {
  const f = fixture();
  assert.equal(
    pruneVerifiedCatalogPages(f.dist, f.art, f.manifestPath, 'owner-book-pack', revision),
    2,
  );
  assert.ok(f.pages.every((page) => !existsSync(page.path)));
});

test('a changed build cannot prune any page or serve stale HTML', () => {
  const f = fixture();
  writeFileSync(f.pages[1].path, '<h1>new editor</h1>');
  assert.throws(
    () => pruneVerifiedCatalogPages(f.dist, f.art, f.manifestPath, 'owner-book-pack', revision),
    /differs/,
  );
  assert.ok(f.pages.every((page) => existsSync(page.path)));
});

test('a previous release cannot authorize pruning the next release', () => {
  const f = fixture();
  assert.throws(
    () =>
      pruneVerifiedCatalogPages(f.dist, f.art, f.manifestPath, 'owner-book-pack', 'b'.repeat(40)),
    /incomplete/,
  );
  assert.ok(f.pages.every((page) => existsSync(page.path)));
});

test('partial, duplicate and foreign manifests cannot hide current pages', () => {
  for (const mutation of [
    (f) => f.manifest.pages.pop(),
    (f) => {
      f.manifest.pages[1] = { ...f.manifest.pages[0] };
    },
    (f) => {
      f.manifest.pages[0].id = 'other-book';
    },
  ]) {
    const f = fixture();
    mutation(f);
    f.save();
    assert.throws(() =>
      pruneVerifiedCatalogPages(f.dist, f.art, f.manifestPath, 'owner-book-pack', revision),
    );
    assert.ok(f.pages.every((page) => existsSync(page.path)));
  }
});
