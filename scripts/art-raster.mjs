import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let sharp;
try {
  sharp = createRequire(import.meta.url)('sharp');
} catch (error) {
  if (!process.env.SHARP_MODULE_ROOT)
    throw new Error(
      'Install sharp with pnpm install or set SHARP_MODULE_ROOT to a node_modules directory.',
      { cause: error },
    );
  sharp = createRequire(resolve(process.env.SHARP_MODULE_ROOT, '../package.json'))('sharp');
}
const arts = JSON.parse(await readFile(resolve(root, 'data/art.json'), 'utf8'));
for (const a of arts) {
  const svg = resolve(root, 'public', a.svg.slice(1));
  await sharp(svg, { density: 288 })
    .resize(2048, 2048)
    .webp({ lossless: true, effort: 6 })
    .toFile(resolve(root, 'public', a.webp.slice(1)));
  await sharp(svg, { density: 96 })
    .resize(440, 440)
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(resolve(root, 'public', a.thumb.slice(1)));
}
console.log(`Rendered ${arts.length} transparent 2048px WebP downloads and 440px thumbnails.`);
