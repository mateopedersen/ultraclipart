import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const siteIconFiles = [
  'favicon.svg',
  'favicon-96.png',
  'favicon-192.png',
  'apple-touch-icon.png',
  'favicon.ico',
];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function buildSiteIcons(root = resolve(import.meta.dirname, '..')) {
  const source = readFileSync(join(root, 'public/logo.svg'), 'utf8');
  if (!/viewBox="0 0 40 44"/.test(source))
    throw Error('Review the logo frame before rebuilding icons');
  const paths = source.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/)?.[1];
  if (!paths || /<(?:script|image|foreignObject)\b|(?:href|url)\s*=/i.test(paths))
    throw Error('Unexpected logo content');
  const square = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><title>UltraClipart</title><g transform="translate(4 2)">${paths}</g></svg>\n`,
  );
  const outputs = new Map([['favicon.svg', square]]);
  for (const [file, size] of [
    ['favicon-96.png', 96],
    ['favicon-192.png', 192],
    ['apple-touch-icon.png', 180],
  ])
    outputs.set(file, await sharp(square).resize(size, size).png().toBuffer());
  const icoImages = await Promise.all(
    [16, 32, 48].map((size) => sharp(square).resize(size, size).png().toBuffer()),
  );
  const header = Buffer.alloc(6 + icoImages.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(icoImages.length, 4);
  let offset = header.length;
  icoImages.forEach((bytes, index) => {
    const size = [16, 32, 48][index],
      entry = 6 + index * 16;
    header[entry] = size;
    header[entry + 1] = size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(bytes.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += bytes.length;
  });
  outputs.set('favicon.ico', Buffer.concat([header, ...icoImages]));
  for (const [name, bytes] of outputs) {
    const file = join(root, 'public', name);
    if (!existsSync(file) || sha(readFileSync(file)) !== sha(bytes)) writeFileSync(file, bytes);
  }
  return {
    sourceSha256: sha(source),
    files: [...outputs].map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: sha(bytes) })),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(JSON.stringify(await buildSiteIcons(), null, 2));
