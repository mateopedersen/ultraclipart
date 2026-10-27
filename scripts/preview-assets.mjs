// Presentation derivatives only. Verified downloadable originals are never overwritten.
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { validateLocalAssetPath } from './publication-policy.mjs';
import categoryPreviewPicks from '../data/category-preview-picks.json' with { type: 'json' };
import ownerCollectionContexts from './remaining-thirty-one-contexts.json' with { type: 'json' };
const VERSION = 'p1';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const PREVIEW_WIDTHS = [96, 220, 440, 960];
export function previewIdentity(item) {
  for (const kind of ['thumb', 'webp']) {
    validateLocalAssetPath(item[kind]);
    if (!/^[a-f0-9]{64}$/.test(item.files?.[kind]?.sha256 || ''))
      throw Error(`Missing verified preview source: ${item.id}/${kind}`);
  }
  return sha(
    `${VERSION}:${sharp.versions.sharp}:${item.files.thumb.sha256}:${item.files.webp.sha256}`,
  ).slice(0, 24);
}
export function previewUrls(item) {
  const key = previewIdentity(item);
  return Object.fromEntries(
    [...PREVIEW_WIDTHS, 320, 640].map((width) => [
      width,
      `/previews/${VERSION}/${key}-${width}.webp`,
    ]),
  );
}
const jobs = new Map();
export function readPreviewIndex(root = process.cwd()) {
  return JSON.parse(readFileSync(join(root, '.astro/preview-assets.json'), 'utf8'));
}
export function preparePreviewAssets(catalog, root = process.cwd()) {
  const selected = new Set([
    ...Object.values(categoryPreviewPicks),
    ...Object.values(ownerCollectionContexts).map((item) => item.cover),
  ]);
  const topics = new Map();
  for (const item of catalog.filter((item) => item.published && item.indexable && item.topic)) {
    const members = topics.get(item.topic) || [];
    members.push(item);
    topics.set(item.topic, members);
  }
  for (const members of topics.values()) {
    const ordered = [
      ...new Map(
        [...members.filter((item) => item.style === 'Color'), ...members].map((item) => [
          item.id,
          item,
        ]),
      ).values(),
    ];
    ordered.slice(0, 2).forEach((item) => selected.add(item.id));
  }
  const adaptiveKeys = new Set(
    catalog
      .filter((item) => selected.has(item.id) && item.published && item.indexable)
      .map(previewIdentity),
  );
  const jobKey =
    root +
    ':' +
    sha(
      catalog
        .filter((a) => a.published && a.indexable)
        .map(previewIdentity)
        .join('|'),
    );
  if (jobs.has(jobKey)) return jobs.get(jobKey);
  const pending = (async () => {
    const cachePath = join(root, '.astro/preview-assets.json');
    let cache = {};
    try {
      cache = JSON.parse(readFileSync(cachePath, 'utf8'));
    } catch {}
    const next = {};
    const stats = { generated: 0, reused: 0, bytes: 0 };
    const unique = [
      ...new Map(
        catalog.filter((a) => a.published && a.indexable).map((a) => [previewIdentity(a), a]),
      ).values(),
    ];
    // Large detail previews get a middle size; small artwork needs no extra file.
    // Keep the 960px copy for desktop/high-density displays and the original for downloads.
    const ensureMedium = async (record, item, sources, urls, width = 640) => {
      if (
        width === 640 &&
        (record.files[960].bytes <= 100000 ||
          Math.max(record.files[960].width, record.files[960].height) <= 640)
      )
        return;
      const file = join(root, 'public', urls[width]);
      const previous = record.files[width];
      if (previous && existsSync(file)) {
        const stat = statSync(file);
        if (
          stat.size === previous.bytes &&
          (stat.mtimeMs === previous.mtime || sha(readFileSync(file)) === previous.sha256)
        ) {
          previous.mtime = stat.mtimeMs;
          stats.reused++;
          stats.bytes += previous.bytes;
          return;
        }
      }
      const kind = width <= 440 ? 'thumb' : 'webp';
      const source = readFileSync(sources[kind]);
      if (sha(source) !== item.files[kind].sha256)
        throw Error(`Changed original preview source: ${item.id}/${kind}`);
      const { data, info } = await sharp(source)
        .rotate()
        .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80, alphaQuality: 100, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      const temporary = `${file}.${process.pid}.tmp`;
      writeFileSync(temporary, data);
      renameSync(temporary, file);
      record.files[width] = {
        bytes: data.length,
        sha256: sha(data),
        mtime: statSync(file).mtimeMs,
        width: info.width,
        height: info.height,
      };
      stats.generated++;
      stats.bytes += data.length;
    };
    let cursor = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (cursor < unique.length) {
          const item = unique[cursor++],
            key = previewIdentity(item),
            urls = previewUrls(item);
          const sources = Object.fromEntries(
            ['thumb', 'webp'].map((kind) => [kind, join(root, 'public', item[kind])]),
          );
          const signature = ['thumb', 'webp']
            .map((kind) => {
              const s = statSync(sources[kind]);
              return `${s.size}:${s.mtimeMs}`;
            })
            .join('|');
          const previous = cache[key];
          if (
            previous &&
            PREVIEW_WIDTHS.every((w) => {
              const file = join(root, 'public', urls[w]);
              if (!existsSync(file)) return false;
              const s = statSync(file),
                record = previous.files?.[w];
              if (!record || s.size !== record.bytes) return false;
              if (s.mtimeMs !== record.mtime && sha(readFileSync(file)) !== record.sha256)
                return false;
              record.mtime = s.mtimeMs;
              return true;
            })
          ) {
            // Restored CI caches have new mtimes. Verify bytes instead of recompressing
            // every image; a changed original still invalidates its source review.
            if (previous.source !== signature)
              for (const kind of ['thumb', 'webp']) {
                if (sha(readFileSync(sources[kind])) !== item.files[kind].sha256)
                  throw Error(`Changed original preview source: ${item.id}/${kind}`);
              }
            next[key] = { ...previous, source: signature };
            stats.reused += 4;
            stats.bytes += PREVIEW_WIDTHS.reduce((n, w) => n + previous.files[w].bytes, 0);
            await ensureMedium(next[key], item, sources, urls);
            if (adaptiveKeys.has(key)) await ensureMedium(next[key], item, sources, urls, 320);
            continue;
          }
          const buffers = {};
          for (const kind of ['thumb', 'webp']) {
            buffers[kind] = readFileSync(sources[kind]);
            if (sha(buffers[kind]) !== item.files[kind].sha256)
              throw Error(`Changed original preview source: ${item.id}/${kind}`);
          }
          const files = {};
          for (const width of PREVIEW_WIDTHS) {
            const source = width <= 440 ? buffers.thumb : buffers.webp;
            const { data, info } = await sharp(source)
              .rotate()
              .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 80, alphaQuality: 100, effort: 4 })
              .toBuffer({ resolveWithObject: true });
            const file = join(root, 'public', urls[width]);
            mkdirSync(resolve(file, '..'), { recursive: true });
            const temp = file + `.${process.pid}.tmp`;
            writeFileSync(temp, data);
            renameSync(temp, file);
            files[width] = {
              bytes: data.length,
              sha256: sha(data),
              mtime: statSync(file).mtimeMs,
              width: info.width,
              height: info.height,
            };
            stats.generated++;
            stats.bytes += data.length;
          }
          next[key] = { source: signature, files };
          await ensureMedium(next[key], item, sources, urls);
          if (adaptiveKeys.has(key)) await ensureMedium(next[key], item, sources, urls, 320);
        }
      }),
    );
    mkdirSync(resolve(cachePath, '..'), { recursive: true });
    const tempCache = cachePath + `.${process.pid}.tmp`;
    writeFileSync(tempCache, JSON.stringify(next));
    renameSync(tempCache, cachePath);
    return stats;
  })();
  jobs.set(jobKey, pending);
  pending.then(
    () => jobs.delete(jobKey),
    () => jobs.delete(jobKey),
  );
  return pending;
}
