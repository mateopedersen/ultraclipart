import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { artwork, manifestFor } from './fixtures/publication.mjs';
import { restoreAssets } from '../scripts/restore-assets.mjs';
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'uc-restore-')),
    bodies = new Map();
  mkdirSync(join(root, 'public'));
  const catalog = [artwork('real-art', bodies)],
    manifest = manifestFor(catalog);
  return { root, catalog, manifest, bodies };
}
test('clean checkout restores exact CDN bytes, then reuses verified local files without network', async () => {
  const f = fixture();
  let requests = 0;
  try {
    const fetcher = async (url) => {
      requests++;
      const file = f.manifest.files.find((x) => x.url === url);
      return new Response(f.bodies.get(file.path), {
        headers: { 'Content-Type': file.contentType },
      });
    };
    assert.deepEqual(await restoreAssets({ ...f, fetcher }), { restored: 4, retained: 0 });
    assert.deepEqual(await restoreAssets({ ...f, fetcher }), { restored: 0, retained: 4 });
    assert.equal(requests, 4);
    for (const [path, body] of f.bodies)
      assert.deepEqual(readFileSync(join(f.root, 'public', path)), body);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
test('corrupt, oversized and wrong-type remote bytes never become build sources; local edits survive', async () => {
  const f = fixture();
  try {
    for (const [body, type, pattern] of [
      [Buffer.from('corrupt'), 'image/svg+xml', /checksum/],
      [Buffer.alloc(500), 'image/svg+xml', /byte count/],
      [Buffer.from('bad'), 'text/html', /download failed/],
    ]) {
      await assert.rejects(
        restoreAssets({
          ...f,
          fetcher: async () => new Response(body, { headers: { 'Content-Type': type } }),
        }),
        pattern,
      );
      assert.equal(existsSync(join(f.root, 'public', f.catalog[0].svg)), false);
    }
    const file = join(f.root, 'public', f.catalog[0].svg);
    writeFileSync(file, 'local edit');
    await assert.rejects(
      restoreAssets({
        ...f,
        fetcher: () => {
          throw new Error('must not fetch');
        },
      }),
      /Local asset changed/,
    );
    assert.equal(readFileSync(file, 'utf8'), 'local edit');
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
test('a public-directory symlink cannot write outside the workspace', async () => {
  const f = fixture(),
    outside = mkdtempSync(join(tmpdir(), 'uc-outside-'));
  try {
    symlinkSync(outside, join(f.root, 'public/pilot'));
    await assert.rejects(
      restoreAssets({
        ...f,
        fetcher: () => {
          throw new Error('must not fetch');
        },
      }),
      /escapes public/,
    );
    assert.equal(existsSync(join(outside, 'real-art.svg')), false);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
