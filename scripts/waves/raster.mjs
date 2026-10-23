import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const [source, target, thumb] = process.argv.slice(2);
const svg = await readFile(source);
const pixels = await sharp(svg, { density: 288 }).resize(2048, 2048).ensureAlpha().raw().toBuffer();
const digest = (body) => createHash('sha256').update(body).digest('hex');
const raw = { width: 2048, height: 2048, channels: 4 };
const candidates = [];
for (const quality of [80, 100]) {
  const body = await sharp(pixels, { raw }).webp({ lossless: true, effort: 6, quality }).toBuffer();
  const decoded = await sharp(body).ensureAlpha().raw().toBuffer();
  if (!decoded.equals(pixels)) throw new Error('Lossless encoding changed RGBA pixels');
  candidates.push({ quality, body });
}
candidates.sort((a, b) => a.body.length - b.body.length);
await writeFile(target, candidates[0].body);
const preview = await sharp(svg, { density: 96 })
  .resize(440, 440)
  .webp({ lossless: true, effort: 6 })
  .toBuffer();
await writeFile(thumb, preview);
console.log(
  JSON.stringify({
    sourcePixelsSha256: digest(pixels),
    effort: 6,
    selectedLosslessQualityParameter: candidates[0].quality,
    candidates: candidates.map(({ quality, body }) => ({ quality, bytes: body.length })),
    losslessDecodedPixelsEqual: true,
    width: 2048,
    height: 2048,
    transparent: true,
  }),
);
