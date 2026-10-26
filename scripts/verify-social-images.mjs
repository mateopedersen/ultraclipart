import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { pages } from './social/pages.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const rendererFiles = [
  'scripts/build-social-images.mjs',
  'scripts/social/render.mjs',
  'scripts/social/compositions.mjs',
  'scripts/social/pages.mjs',
];

/** Publish reviewed PNGs without letting the build host re-render their fonts. */
export function verifySocialImages({ root, definitions = pages }) {
  root = realpathSync(root);
  const read = (path) => readFileSync(resolve(root, path));
  const json = (path) => JSON.parse(read(path));
  const manifest = json('data/social-images.json');
  const provenance = json('data/social-image-provenance.json');
  assert.equal(manifest.version, 1, 'Unsupported social-image manifest');
  assert.equal(provenance.version, 1, 'Unsupported social-image provenance');
  assert.equal(manifest.width, 1200);
  assert.equal(manifest.height, 630);
  assert.equal(manifest.type, 'image/png');
  assert.deepEqual(
    Object.keys(manifest.pages).sort(),
    definitions.map((page) => page.route).sort(),
    'Social-image routes require reviewed covers',
  );
  assert.deepEqual(
    Object.keys(provenance.pages).sort(),
    definitions.map((page) => page.key).sort(),
    'Social-image provenance is incomplete',
  );
  const rendererSha = digest(Buffer.concat(rendererFiles.map(read)));
  assert.deepEqual(provenance.fonts.map((font) => font.weight).sort(), [400, 600, 700]);
  for (const font of provenance.fonts) {
    assert.equal(font.family, 'Inter');
    assert.equal(
      font.sha256,
      digest(read(`node_modules/@fontsource/inter/files/inter-latin-${font.weight}-normal.woff`)),
      'Reviewed social-image font changed',
    );
  }
  const catalog = new Map(json('data/art.json').map((item) => ['public' + item.webp, item]));
  const sourceHashes = new Map();
  function publicSource(path) {
    assert.match(path, /^public\/[a-zA-Z0-9_./-]+$/, 'Invalid social-image source path');
    assert(
      !path.split('/').some((part) => part === '..' || part === '.' || !part),
      'Invalid social-image source segments',
    );
    const absolute = realpathSync(resolve(root, path));
    assert(
      absolute.startsWith(resolve(root, 'public') + sep),
      'Social-image source escapes public',
    );
    return readFileSync(absolute);
  }
  let bytes = 0;
  for (const page of definitions) {
    const cover = manifest.pages[page.route];
    const review = provenance.pages[page.key];
    assert.equal(cover.alt, page.alt, `${page.key}: approved description changed`);
    assert.equal(cover.width, 1200);
    assert.equal(cover.height, 630);
    assert.equal(cover.type, 'image/png');
    assert.match(cover.sha256, /^[a-f0-9]{64}$/);
    assert.equal(cover.src, `/og/${page.key}-${cover.sha256.slice(0, 12)}.png`);
    assert.equal(review.route, page.route);
    assert.equal(
      review.rendererSha,
      rendererSha,
      `${page.key}: renderer changed; regenerate and review covers`,
    );
    assert.equal(review.outputSha256, cover.sha256);
    const png = publicSource('public' + cover.src);
    assert.equal(png.length, cover.bytes, `${page.key}: approved PNG size changed`);
    assert.equal(digest(png), cover.sha256, `${page.key}: approved PNG bytes changed`);
    assert(
      png.length >= 24 && png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      `${page.key}: invalid PNG`,
    );
    assert.equal(png.toString('ascii', 12, 16), 'IHDR');
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    assert(review.text.length > 0, `${page.key}: text proof missing`);
    for (const text of review.text) {
      assert(typeof text.text === 'string' && text.text.length > 0);
      assert(['x', 'y', 'width', 'height', 'size'].every((key) => Number.isFinite(text[key])));
      assert(
        text.size > 0 && text.height >= text.size * 0.5 && text.width > 0,
        `${page.key}: font metrics indicate missing glyphs`,
      );
      assert(
        text.x >= 0 && text.y >= 0 && text.x + text.width <= 1200 && text.y + text.height <= 630,
        `${page.key}: text outside cover`,
      );
    }
    assert(review.sources.length > 0, `${page.key}: source proof missing`);
    for (const source of review.sources) {
      if (!sourceHashes.has(source.path))
        sourceHashes.set(source.path, digest(publicSource(source.path)));
      assert.equal(
        sourceHashes.get(source.path),
        source.sha256,
        `${page.key}: approved image source changed`,
      );
      const artwork = catalog.get(source.path);
      if (artwork) {
        assert(artwork.published && artwork.indexable, `${page.key}: unpublished artwork source`);
        assert.equal(
          source.sha256,
          artwork.files?.webp?.sha256,
          `${page.key}: original artwork checksum differs`,
        );
      }
    }
    bytes += png.length;
  }
  return { pages: definitions.length, sourceFiles: sourceHashes.size, bytes, status: 'passed' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(
    JSON.stringify(verifySocialImages({ root: fileURLToPath(new URL('..', import.meta.url)) })),
  );
}
