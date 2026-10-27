import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
const jobs = new Map<string, Promise<string>>();
// Reproduce the existing screenshot crop exactly; keep the full capture untouched.
export async function screenPreview(source: string, crop: readonly number[]) {
  if (!/^\/(?:guide-screens|home-art)\/[a-z0-9-]+\.(?:png|webp)$/.test(source))
    throw Error('Unsupported screenshot source');
  if (crop.length !== 4 || crop.some((n) => !Number.isInteger(n) || n < 0) || !crop[2] || !crop[3])
    throw Error('Invalid screenshot crop');
  const bytes = readFileSync(join(process.cwd(), 'public', source));
  const hash = createHash('sha256')
    .update(bytes)
    .update(`screen-v1:q90:${crop.join(',')}`)
    .digest('hex')
    .slice(0, 24);
  const url = `/previews/ui/${hash}.webp`,
    file = join(process.cwd(), 'public', url);
  if (existsSync(file)) return url;
  if (!jobs.has(hash))
    jobs.set(
      hash,
      (async () => {
        const result = await sharp(bytes)
          .extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] })
          .webp({ quality: 90, alphaQuality: 100, effort: 4 })
          .toBuffer();
        mkdirSync(join(process.cwd(), 'public/previews/ui'), { recursive: true });
        const temporary = `${file}.${process.pid}.tmp`;
        writeFileSync(temporary, result);
        renameSync(temporary, file);
        return url;
      })(),
    );
  try {
    return await jobs.get(hash)!;
  } finally {
    jobs.delete(hash);
  }
}
