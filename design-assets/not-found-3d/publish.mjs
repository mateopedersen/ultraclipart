import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const path = 'design-assets/not-found-3d/render.png';
const source = readFileSync(path);
const hash = createHash('sha256').update(source).digest('hex');
const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
let left = info.width,
  top = info.height,
  right = 0,
  bottom = 0;
for (let y = 0; y < info.height; y++)
  for (let x = 0; x < info.width; x++)
    if (data[(y * info.width + x) * 4 + 3] > 64) {
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
const pad = 65;
left = Math.max(0, left - pad);
top = Math.max(0, top - pad);
right = Math.min(info.width - 1, right + pad);
bottom = Math.min(info.height - 1, bottom + pad);
const crop = { left, top, width: right - left + 1, height: bottom - top + 1 };
mkdirSync('public/illustrations/not-found', { recursive: true });
const outputs = [];
for (const width of [480, 800, 1200]) {
  const buffer = await sharp(source)
    .extract(crop)
    .resize({ width })
    .webp({ quality: 87, alphaQuality: 100, effort: 6 })
    .toBuffer();
  const outputHash = createHash('sha256').update(buffer).digest('hex');
  const src = `/illustrations/not-found/studio-404-3d-${outputHash.slice(0, 12)}-${width}.webp`;
  writeFileSync('public' + src, buffer);
  const meta = await sharp(buffer).metadata();
  outputs.push({
    src,
    width: meta.width,
    height: meta.height,
    bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  });
}
const full = outputs.at(-1);
const manifest = {
  src: full.src,
  srcset: outputs.map((o) => o.src + ' ' + o.width + 'w').join(', '),
  width: full.width,
  height: full.height,
  title: 'UltraClipart 3D 404 illustration',
  alt: 'Blue and white three-dimensional 404 numerals on a display platform, with a glass magnifying lens and illustration cards.',
  sourceRenderSha256: hash,
  crop,
  files: outputs,
};
writeFileSync('data/not-found-visual.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest));
