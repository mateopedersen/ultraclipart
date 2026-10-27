import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ORIGIN = 'https://ultraclipart.com';
const widths = new Set([96, 220, 320, 440, 640, 960]);
/** This is an optional presentation cache, never an original-asset authority.
 * Its keys bind both original SHA-256s and the encoder version. The committed
 * derivative SHA is checked again before a remote byte can enter the build. */
export function createPreviewCache({ root, index, enabled, fetcher = fetch, report = () => {} }) {
  const stats = { restored: 0, unavailable: 0, rejected: 0, bytes: 0 };
  const entries = index?.schema === 1 && index?.encoder === 'p1' ? index.entries : {};
  let probe;
  const get = (key, width) => entries?.[key]?.files?.[width];
  const valid = (key, width, file) =>
    /^[a-f0-9]{24}$/.test(key) &&
    widths.has(width) &&
    file &&
    Number.isSafeInteger(file.bytes) &&
    file.bytes > 0 &&
    file.bytes <= 4000000 &&
    /^[a-f0-9]{64}$/.test(file.sha256 || '') &&
    Number.isInteger(file.width) &&
    Number.isInteger(file.height) &&
    file.width > 0 &&
    file.height > 0 &&
    Math.max(file.width, file.height) <= width;
  async function restoreFile(key, width) {
    const file = get(key, width);
    if (!valid(key, width, file)) return false;
    const destination = join(root, 'public', 'previews', 'p1', `${key}-${width}.webp`);
    if (existsSync(destination)) {
      const bytes = readFileSync(destination);
      if (bytes.length === file.bytes && digest(bytes) === file.sha256) return true;
    }
    const url = `${ORIGIN}/previews/p1/${key}-${width}.webp`;
    try {
      let response;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await fetcher(url, {
            redirect: 'error',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UltraClipartBuild/1.0)' },
            signal: AbortSignal.timeout(20000),
          });
        } catch (error) {
          if (attempt === 2) throw error;
          continue;
        }
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          await response.body?.cancel();
          continue;
        }
        break;
      }
      if (!response.ok) {
        await response.body?.cancel();
        stats.unavailable++;
        return false;
      }
      if (!response.headers.get('content-type')?.includes('image/webp')) {
        await response.body?.cancel();
        stats.rejected++;
        return false;
      }
      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > 4000000) {
        await response.body?.cancel();
        stats.rejected++;
        return false;
      }
      const parts = [];
      let count = 0;
      for await (const part of response.body) {
        count += part.length;
        if (count > 4000000) throw Error('Preview cache body exceeds its bound');
        parts.push(part);
      }
      const bytes = Buffer.concat(parts);
      if (
        bytes.length !== file.bytes ||
        digest(bytes) !== file.sha256 ||
        bytes.toString('ascii', 0, 4) !== 'RIFF' ||
        bytes.toString('ascii', 8, 12) !== 'WEBP'
      ) {
        stats.rejected++;
        return false;
      }
      mkdirSync(join(root, 'public', 'previews', 'p1'), { recursive: true });
      const temporary = `${destination}.${process.pid}.cache.tmp`;
      writeFileSync(temporary, bytes);
      renameSync(temporary, destination);
      stats.restored++;
      stats.bytes += bytes.length;
      if (stats.restored % 1000 === 0) report({ ...stats });
      return true;
    } catch {
      stats.unavailable++;
      return false;
    }
  }
  return {
    stats,
    async restore(key, requestedWidths) {
      if (!enabled || !entries?.[key]) return null;
      // A prior release without this cache must not trigger thousands of 404s.
      // Probe one immutable file; when it is unavailable, encode from originals.
      if (!probe) {
        const first = [...widths].find((width) => valid(key, width, get(key, width)));
        probe = first === undefined ? Promise.resolve(false) : restoreFile(key, first);
      }
      if (!(await probe)) return null;
      // At most six unique sizes per item, with four item workers in the encoder.
      // Keep clean-build latency bounded without an unbounded request fan-out.
      const selected = [...new Set(requestedWidths)].filter((width) =>
        valid(key, width, get(key, width)),
      );
      const restored = await Promise.all(selected.map((width) => restoreFile(key, width)));
      if (restored.some((accepted) => !accepted)) return null;
      const files = Object.fromEntries(
        selected.map((width) => [
          width,
          {
            ...get(key, width),
            mtime: statSync(join(root, 'public', 'previews', 'p1', `${key}-${width}.webp`)).mtimeMs,
          },
        ]),
      );
      return { source: 'restored-verified-cache', files };
    },
  };
}
