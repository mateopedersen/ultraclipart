import {
  readFileSync,
  existsSync,
  mkdirSync,
  realpathSync,
  writeFileSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { validateManifest, catalogFiles, assetIdentity } from './publication-policy.mjs';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

class TransientDownloadError extends Error {}

/** Retry transport failures only; content-integrity failures must stop the build. */
export async function downloadAsset(file, fetcher = fetch, pause = delay) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(file.url, {
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
      });
      if ([408, 429].includes(response.status) || response.status >= 500) {
        await response.body?.cancel();
        throw new TransientDownloadError(`HTTP ${response.status}`);
      }
      if (
        !response.ok ||
        response.headers.get('content-type')?.split(';')[0] !== file.contentType ||
        !response.body
      ) {
        await response.body?.cancel();
        throw new Error(`Asset download failed: ${file.assetId}/${file.kind}`);
      }
      const chunks = [];
      let size = 0;
      const reader = response.body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > file.bytes) {
            await reader.cancel();
            throw new Error('Asset exceeds verified byte count');
          }
          chunks.push(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = Buffer.concat(chunks, size);
      if (size !== file.bytes || sha(bytes) !== file.sha256)
        throw new Error('Asset checksum mismatch');
      return bytes;
    } catch (error) {
      const transient =
        error instanceof TransientDownloadError ||
        error instanceof TypeError ||
        ['TimeoutError', 'AbortError'].includes(error?.name);
      if (!transient || attempt === 2)
        throw new Error(`Cannot restore ${file.assetId}/${file.kind}: ${error.message}`, {
          cause: error,
        });
      await pause(250 * 4 ** attempt);
    }
  }
}

/** Restore only hash-pinned catalog bytes from the approved public CDN.
 * Art binaries stay out of Git. A clean checkout needs no account credentials. */
export async function restoreAssets({ root, catalog, manifest, fetcher = fetch, concurrency = 8 }) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 16)
    throw new Error('Asset restore concurrency must be an integer from 1 to 16');
  const files = validateManifest(manifest),
    expected = catalogFiles(catalog);
  if (expected.length !== files.size) throw new Error('Catalog and publication differ');
  const publicRoot = realpathSync(join(root, 'public'));
  let restored = 0,
    retained = 0,
    cursor = 0;
  async function worker() {
    while (cursor < expected.length) {
      const file = expected[cursor++];
      const published = files.get(assetIdentity(file.assetId, file.kind));
      if (!published || ['path', 'bytes', 'sha256'].some((key) => file[key] !== published[key]))
        throw new Error('Publication does not match the requested source');
      if (file.bytes > 16_000_000) throw new Error('Asset exceeds build download bound');
      const target = join(publicRoot, file.path);
      let ancestor = dirname(target);
      while (!existsSync(ancestor)) ancestor = dirname(ancestor);
      const resolvedAncestor = realpathSync(ancestor);
      if (resolvedAncestor !== publicRoot && !resolvedAncestor.startsWith(publicRoot + '/'))
        throw new Error('Asset parent escapes public/');
      mkdirSync(dirname(target), { recursive: true });
      if (!realpathSync(dirname(target)).startsWith(publicRoot + '/'))
        throw new Error('Asset parent escapes public/');
      if (existsSync(target)) {
        if (!realpathSync(target).startsWith(publicRoot + '/'))
          throw new Error('Asset symlink escapes public/');
        const local = readFileSync(target);
        if (local.length === file.bytes && sha(local) === file.sha256) {
          retained++;
          continue;
        }
        throw new Error(`Local asset changed: ${file.path}; preserve edits before restoring`);
      }
      const bytes = await downloadAsset(published, fetcher);
      const temp = `${target}.${process.pid}.tmp`;
      try {
        writeFileSync(temp, bytes, { flag: 'wx' });
        renameSync(temp, target);
      } finally {
        rmSync(temp, { force: true });
      }
      restored++;
    }
  }
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, expected.length) }, worker),
  );
  const failed = results.find((result) => result.status === 'rejected');
  if (failed) throw failed.reason;
  return { restored, retained };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(import.meta.dirname, '..'),
    read = (name) => JSON.parse(readFileSync(join(root, 'data', name)));
  console.log(
    await restoreAssets({
      root,
      catalog: read('art.json'),
      manifest: read('publication.json'),
      // Public CDN reads, not authenticated R2 API calls. Each object retains
      // its 16 MB bound, MIME/hash checks and atomic write before build use.
      concurrency: process.env.CF_PAGES === '1' ? 16 : 8,
    }),
  );
}
