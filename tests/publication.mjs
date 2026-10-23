import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPublication, validatePublication } from '../scripts/publication-policy.mjs';
import { artwork, manifestFor } from './fixtures/publication.mjs';
const fixture = () => {
  const bodies = new Map();
  const item = artwork('drawing-one', bodies);
  return {
    manifest: manifestFor([item]),
    catalog: [item],
    read: (path) => bodies.get(path),
    bodies,
  };
};
test('production requires a complete byte-identical per-file CDN release', () => {
  const f = fixture(),
    release = validatePublication(f.manifest, f.catalog, f.read);
  assert.equal(release.files, 4);
  assert.equal(release.bytes, f.manifest.bytes);
  assert.deepEqual(
    release.localPaths,
    Object.keys(f.catalog[0].files).map((kind) => f.catalog[0][kind]),
  );
  assert.deepEqual(
    release.urls,
    f.manifest.files.map((file) => file.url),
  );
  for (const file of f.manifest.files)
    assert.equal(release.assetUrls[file.assetId][file.kind], file.url);
  f.bodies.set('/pilot/drawing-one.svg', Buffer.from('changed after verification'));
  assert.throws(() => validatePublication(f.manifest, f.catalog, f.read), /Source changed/);
});
test('unverified, missing, duplicated or mismatched publication records fail closed', () => {
  for (const mutate of [
    (m) => (m.status = 'pending'),
    (m) => (m.schema = 1),
    (m) => m.files.pop(),
    (m) => m.files.push(m.files[0]),
    (m) => (m.files[0].sha256 = 'b'.repeat(64)),
    (m) => m.bytes++,
    (m) => (m.files[0].contentType = 'text/plain'),
    (m) => (m.files[0].corsOrigin = 'https://other.example'),
    (m) => (m.files[0].verification = 'uploaded-only'),
  ]) {
    const f = fixture();
    mutate(f.manifest);
    assert.throws(() => validatePublication(f.manifest, f.catalog, f.read));
  }
});
test('wrong-origin, mutable, ambiguous and query-bearing URLs are forbidden', () => {
  for (const url of [
    'http://assets.ultraclipart.com/pilot-123456abcdef/drawing-one.svg',
    'https://evil.example/pilot-123456abcdef/drawing-one.svg',
    'https://assets.ultraclipart.com/drawing-one.svg',
    'https://assets.ultraclipart.com/pilot-123456abcdef/drawing-one.svg?q=1',
    'https://assets.ultraclipart.com/pilot-123456abcdef/drawing-one.svg#fragment',
    'https://user@assets.ultraclipart.com/pilot-123456abcdef/drawing-one.svg',
    'https://assets.ultraclipart.com/pilot-123456abcdef/%2E%2E/drawing-one.svg',
    'https://assets.ultraclipart.com:443/pilot-123456abcdef/drawing-one.svg',
  ]) {
    const f = fixture();
    f.manifest.files[0].url = url;
    assert.throws(() => validatePublication(f.manifest, f.catalog, f.read));
  }
});
test('source paths must remain normalized under public', () => {
  for (const path of [
    '/../secret.svg',
    '/pilot//drawing-one.svg',
    '/pilot/%2e%2e/file.svg',
    '/pilot/drawing-one.svg?raw=1',
    'pilot/drawing-one.svg',
  ]) {
    const f = fixture();
    f.manifest.files[0].path = path;
    f.catalog[0].svg = path;
    assert.throws(() => validatePublication(f.manifest, f.catalog, f.read), /path|filename/);
  }
});
test('production refuses a source symlink outside public even when its bytes match', () => {
  const f = fixture(),
    root = mkdtempSync(join(tmpdir(), 'ultraclipart-publication-'));
  try {
    mkdirSync(join(root, 'data'));
    mkdirSync(join(root, 'public/pilot'), { recursive: true });
    writeFileSync(join(root, 'data/art.json'), JSON.stringify(f.catalog));
    writeFileSync(join(root, 'data/publication.json'), JSON.stringify(f.manifest));
    for (const [path, body] of f.bodies) writeFileSync(join(root, 'public', path), body);
    const source = join(root, 'public', f.catalog[0].svg),
      outside = join(root, 'private-source.svg');
    writeFileSync(outside, f.bodies.get(f.catalog[0].svg));
    rmSync(source);
    symlinkSync(outside, source);
    assert.throws(() => readPublication(root), /symlink escapes/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('the checked release covers every catalog representation with verified source bytes', () => {
  const result = readPublication(fileURLToPath(new URL('..', import.meta.url)));
  const catalog = JSON.parse(readFileSync(new URL('../data/art.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(
    readFileSync(new URL('../data/publication.json', import.meta.url), 'utf8'),
  );
  assert.equal(result.files, catalog.length * 4);
  assert.equal(new Set(result.urls).size, result.files);
  assert.deepEqual(
    result.urls,
    manifest.files.map((file) => file.url),
  );
});
