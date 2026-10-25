import { readFile, writeFile, mkdir, stat, rename, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';

// Inspect the original thumbnail, never a CSS grayscale preview. Small channel
// differences are normal in compressed gray artwork; colored accents are not.
const SCHEMA = 2;
export async function auditMonochrome(catalog, root = process.cwd()) {
  const cachePath = join(root, '.astro/monochrome/catalog.json');
  let previous = {};
  try {
    const saved = JSON.parse(await readFile(cachePath, 'utf8'));
    if (saved.schema === SCHEMA && saved.assets && typeof saved.assets === 'object')
      previous = saved.assets;
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
  const assets = {};
  const result = new Map();
  let next = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < catalog.length) {
        const item = catalog[next++];
        if (!item.published || !item.indexable) continue;
        const path = resolve(root, 'public', item.thumb.replace(/^\//, ''));
        if (!path.startsWith(resolve(root, 'public') + '/'))
          throw new Error('Invalid thumbnail path');
        const file = await stat(path);
        const expected = item.files?.thumb?.sha256;
        const signature = `${expected ?? ''}:${file.size}:${file.mtimeMs}`;
        let measurement =
          previous[item.id]?.signature === signature ? previous[item.id].measurement : null;
        if (!measurement) {
          const bytes = await readFile(path);
          if (expected && createHash('sha256').update(bytes).digest('hex') !== expected)
            throw new Error(`Thumbnail differs from approved catalog: ${item.id}`);
          const { data } = await sharp(bytes)
            .toColourspace('srgb')
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          let visible = 0,
            chromatic = 0,
            saturated = 0,
            ink = 0,
            spread = 0;
          for (let p = 0; p < data.length; p += 4) {
            if (data[p + 3] < 128) continue;
            const high = Math.max(data[p], data[p + 1], data[p + 2]);
            const low = Math.min(data[p], data[p + 1], data[p + 2]);
            visible++;
            spread += high - low;
            if (high - low > 12) chromatic++;
            if (high - low > 28) saturated++;
            if (high < 230) ink++;
          }
          measurement = {
            visible,
            chromatic: chromatic / (visible || 1),
            saturated: saturated / (visible || 1),
            spread: spread / (visible || 1),
            ink: ink / (visible || 1),
          };
        }
        assets[item.id] = { signature, measurement };
        const declared = ['Outline', 'Black & White'].includes(item.style);
        const neutral =
          measurement.visible > 0 &&
          measurement.ink > 0.02 &&
          // Declared ink drawings can have a very light paper/scan tint.
          ((declared &&
            measurement.chromatic <= 0.06 &&
            measurement.saturated <= 0.001 &&
            measurement.spread <= 9) ||
            (measurement.chromatic <= 0.005 &&
              measurement.saturated <= 0.001 &&
              measurement.spread <= 6));
        const lineDrawing =
          item.style === 'Outline' ||
          /\b(?:continuous[ -]line|single[ -]line|line[ -]art|line drawing|outline)\b/i.test(
            item.title,
          );
        result.set(item.id, {
          monochrome: neutral,
          kind: neutral
            ? lineDrawing
              ? 'outline'
              : item.style === 'Silhouette'
                ? 'silhouette'
                : 'grayscale'
            : null,
        });
      }
    }),
  );
  const sortedAssets = Object.fromEntries(
    Object.entries(assets).sort(([a], [b]) => a.localeCompare(b)),
  );
  const serialized = JSON.stringify({ schema: SCHEMA, assets: sortedAssets });
  if (JSON.stringify(previous) !== JSON.stringify(sortedAssets)) {
    await mkdir(join(root, '.astro/monochrome'), { recursive: true });
    const temporary = `${cachePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, serialized);
      await rename(temporary, cachePath);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  return result;
}
