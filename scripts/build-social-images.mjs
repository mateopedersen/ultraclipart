import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRenderer } from './social/render.mjs';
import { compose } from './social/compositions.mjs';
import { pages } from './social/pages.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const { Canvas, sharp, source, sha, fonts, work } = await createRenderer(root);
const catalog = new Map(
  JSON.parse(await readFile(join(root, 'data/art.json'), 'utf8'))
    .filter((item) => item.published && item.indexable)
    .map((item) => [item.id, item]),
);
const originals = new Map([...catalog.values()].map((item) => [`public${item.webp}`, item]));
for (const field of ['key', 'route']) {
  if (new Set(pages.map((page) => page[field])).size !== pages.length)
    throw new Error(`Duplicate social-image ${field}`);
}
const output = join(root, 'public/og');
await mkdir(output, { recursive: true });
const manifest = { version: 1, width: 1200, height: 630, type: 'image/png', pages: {} };
const provenance = {
  version: 1,
  renderer:
    'SVG compositions, local Inter typography and existing approved artwork; no image model generation',
  fonts,
  pages: {},
};
const rendererSha = sha(
  Buffer.concat(
    await Promise.all(
      [
        'scripts/build-social-images.mjs',
        'scripts/social/render.mjs',
        'scripts/social/compositions.mjs',
        'scripts/social/pages.mjs',
      ].map((path) => readFile(join(root, path))),
    ),
  ),
);
for (const page of pages) {
  const c = new Canvas(page.dark ? '#1c426f' : '#f4f8ff');
  if (!page.dark) c.rect(564, 90, 614, 463, '#eaf2fd', 25);
  await c.brand({ dark: page.dark });
  await c.title(page.title, page.subtitle, { dark: page.dark, size: page.titleSize || 59 });
  await compose(c, page, catalog);
  for (const path of c.sources) {
    const item = originals.get(path);
    if (item) {
      const expected = item.files?.webp?.sha256;
      if (!/^[a-f0-9]{64}$/.test(expected ?? ''))
        throw new Error(`Missing social-image source checksum: ${item.id}`);
      const actual = sha(await source(path));
      if (actual !== expected) throw new Error(`Unverified social-image source: ${item.id}`);
    }
  }
  const bytes = await c.png();
  const digest = sha(bytes);
  const file = `${page.key}-${digest.slice(0, 12)}.png`;
  await writeFile(join(output, file), bytes);
  manifest.pages[page.route] = {
    src: `/og/${file}`,
    alt: page.alt,
    width: 1200,
    height: 630,
    type: 'image/png',
    sha256: digest,
    bytes: bytes.length,
  };
  provenance.pages[page.key] = {
    route: page.route,
    rendererSha,
    outputSha256: digest,
    sources: c.provenance(),
    text: c.textBounds,
  };
  console.log(`${page.key}: ${Math.round(bytes.length / 1024)} KiB`);
}
await writeFile(join(root, 'data/social-images.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(
  join(root, 'data/social-image-provenance.json'),
  JSON.stringify(provenance, null, 2) + '\n',
);
// Retire only old generated names; never remove manually supplied or unrelated images.
const current = new Set(Object.values(manifest.pages).map((entry) => entry.src.split('/').at(-1)));
for (const file of await readdir(output))
  if (/^[a-z-]+-[a-f0-9]{12}\.png$/.test(file) && !current.has(file))
    await unlink(join(output, file));
const previewLayers = [];
for (const [i, page] of pages.entries()) {
  const src = join(root, 'public', manifest.pages[page.route].src);
  const input = await sharp(src).resize(360, 189).png().toBuffer();
  previewLayers.push({ input, left: (i % 4) * 380 + 10, top: Math.floor(i / 4) * 209 + 10 });
}
const overview = await sharp({
  create: {
    width: 1520,
    height: Math.ceil(pages.length / 4) * 209,
    channels: 3,
    background: '#d3dce8',
  },
})
  .composite(previewLayers)
  .png()
  .toBuffer();
await writeFile(join(work, 'contact-sheet.png'), overview);
const designOutput = join(root, 'design-assets/social');
await mkdir(designOutput, { recursive: true });
await writeFile(join(designOutput, 'overview.png'), overview);
console.log(
  `${pages.length} page-specific social images generated. Contact sheet: .astro/social-images/contact-sheet.png`,
);
