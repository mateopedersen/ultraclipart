import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createPreviewCache } from '../scripts/preview-cache.mjs';
const key = 'a'.repeat(24),
  other = 'b'.repeat(24);
const bytes = await sharp({ create: { width: 24, height: 24, channels: 4, background: '#1464d4' } })
  .webp()
  .toBuffer();
const file = {
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  width: 24,
  height: 24,
};
const index = {
  schema: 1,
  encoder: 'p1',
  entries: { [key]: { files: { 96: file, 220: file, 440: file, 960: file } } },
};
const good = () =>
  new Response(bytes, {
    headers: { 'content-type': 'image/webp', 'content-length': String(bytes.length) },
  });
function root(t) {
  const path = mkdtempSync(join(tmpdir(), 'uc-preview-cache-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}
test('clean builds restore only exact committed source-keyed preview bytes', async (t) => {
  const path = root(t),
    urls = [];
  const cache = createPreviewCache({
    root: path,
    index,
    enabled: true,
    fetcher: async (url) => {
      urls.push(url);
      return good();
    },
  });
  const result = await cache.restore(key, [96, 220, 440, 960]);
  assert.equal(Object.keys(result.files).length, 4);
  assert.equal(cache.stats.restored, 4);
  assert.equal(urls.length, 4);
  assert.ok(urls.every((url) => url.startsWith('https://ultraclipart.com/previews/p1/')));
  assert.deepEqual(readFileSync(join(path, `public/previews/p1/${key}-440.webp`)), bytes);
  await cache.restore(key, [96, 220, 440, 960]);
  assert.equal(urls.length, 4);
});
test('changed or unknown sources never reuse an old key and local builds do no network', async (t) => {
  const path = root(t);
  let reads = 0;
  const fetcher = async () => {
    reads++;
    return good();
  };
  assert.equal(
    await createPreviewCache({ root: path, index, enabled: true, fetcher }).restore(other, [96]),
    null,
  );
  assert.equal(
    await createPreviewCache({ root: path, index, enabled: false, fetcher }).restore(key, [96]),
    null,
  );
  assert.equal(reads, 0);
});
test('wrong bytes, types and overlarge responses cannot enter the build', async (t) => {
  for (const response of [
    new Response('wrong', { headers: { 'content-type': 'image/webp' } }),
    new Response(bytes, { headers: { 'content-type': 'text/html' } }),
    new Response(bytes, { headers: { 'content-type': 'image/webp', 'content-length': '4000001' } }),
  ]) {
    const path = root(t);
    const cache = createPreviewCache({
      root: path,
      index,
      enabled: true,
      fetcher: async () => response,
    });
    assert.equal(await cache.restore(key, [96]), null);
    assert.equal(cache.stats.restored, 0);
    assert.equal(existsSync(join(path, `public/previews/p1/${key}-96.webp`)), false);
  }
});
test('an unavailable prior release is probed once, then original encoding is used', async (t) => {
  const path = root(t);
  let reads = 0;
  const cache = createPreviewCache({
    root: path,
    index,
    enabled: true,
    fetcher: async () => {
      reads++;
      return new Response('missing', { status: 404 });
    },
  });
  const result = await Promise.all(
    Array.from({ length: 20 }, () => cache.restore(key, [96, 220, 440, 960])),
  );
  assert.ok(result.every((item) => item === null));
  assert.equal(reads, 1);
});
test('untrusted manifest paths and invalid dimensions never become requests', async (t) => {
  const path = root(t);
  let reads = 0;
  const cache = createPreviewCache({
    root: path,
    index: {
      ...index,
      entries: {
        '../../escape': { files: { 96: file } },
        [key]: { files: { 96: { ...file, width: 99999 } } },
      },
    },
    enabled: true,
    fetcher: async () => {
      reads++;
      return good();
    },
  });
  assert.equal(await cache.restore('../../escape', [96]), null);
  assert.equal(await cache.restore(key, [96]), null);
  assert.equal(reads, 0);
});

test('duplicate requested sizes stay bounded and every concurrent response is awaited', async (t) => {
  const path = root(t);
  let reads = 0,
    active = 0,
    maximum = 0;
  const cache = createPreviewCache({
    root: path,
    index,
    enabled: true,
    fetcher: async () => {
      reads++;
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return good();
    },
  });
  const requested = Array.from({ length: 1000 }, () => [96, 220, 440, 960]).flat();
  const result = await cache.restore(key, requested);
  assert.equal(Object.keys(result.files).length, 4);
  assert.equal(reads, 4);
  assert.ok(maximum <= 4);
  assert.equal(active, 0);
});
