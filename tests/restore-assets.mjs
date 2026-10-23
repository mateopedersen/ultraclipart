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
import { restoreAssets, downloadAsset } from '../scripts/restore-assets.mjs';
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'uc-restore-')),
    bodies = new Map();
  mkdirSync(join(root, 'public'));
  const catalog = [artwork('real-art', bodies)],
    manifest = manifestFor(catalog);
  return { root, catalog, manifest, bodies };
}
test('transient downloads restart with empty buffers and preserve the verified bytes', async () => {
  const f = fixture(),
    file = f.manifest.files[0],
    body = f.bodies.get(file.path),
    pauses = [],
    signals = [];
  let requests = 0;
  try {
    const bytes = await downloadAsset(
      file,
      async (_url, options) => {
        signals.push(options.signal);
        assert.equal(options.redirect, 'error');
        requests++;
        if (requests === 1) return new Response('unavailable', { status: 503 });
        if (requests === 2) {
          let pulled = false;
          return new Response(
            new ReadableStream({
              pull(controller) {
                if (pulled) controller.error(new DOMException('Timed out', 'TimeoutError'));
                else {
                  pulled = true;
                  controller.enqueue(body.subarray(0, 3));
                }
              },
            }),
            { headers: { 'Content-Type': file.contentType } },
          );
        }
        return new Response(body, { headers: { 'Content-Type': file.contentType } });
      },
      async (ms) => pauses.push(ms),
    );
    assert.deepEqual(bytes, body);
    assert.equal(requests, 3);
    assert.equal(new Set(signals).size, 3);
    assert.deepEqual(pauses, [250, 1000]);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
test('persistent network failures stop after three attempts; invalid content never retries', async () => {
  const f = fixture(),
    file = f.manifest.files[0];
  try {
    let requests = 0;
    await assert.rejects(
      downloadAsset(
        file,
        async () => {
          requests++;
          throw new TypeError('fetch failed');
        },
        async () => {},
      ),
      /Cannot restore.*fetch failed/,
    );
    assert.equal(requests, 3);
    for (const response of [
      () => new Response('missing', { status: 404 }),
      () => new Response('incorrect', { headers: { 'Content-Type': file.contentType } }),
      () => new Response('incorrect', { headers: { 'Content-Type': 'text/html' } }),
      () =>
        new Response(Buffer.alloc(file.bytes + 1), {
          headers: { 'Content-Type': file.contentType },
        }),
    ]) {
      requests = 0;
      await assert.rejects(
        downloadAsset(
          file,
          async () => {
            requests++;
            return response();
          },
          async () => assert.fail('Integrity failures must not retry'),
        ),
      );
      assert.equal(requests, 1);
    }
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
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
