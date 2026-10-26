import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { verifySocialImages } from '../scripts/verify-social-images.mjs';

const root = resolve(import.meta.dirname, '..');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const approved = JSON.parse(readFileSync(join(root, 'data/social-images.json')));
const png = readFileSync(join(root, 'public', approved.pages['/'].src));
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'ultraclipart-approved-social-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const put = (path, bytes) => {
    const file = join(directory, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  };
  const definitions = [{ key: 'home', route: '/', alt: 'Reviewed cover' }];
  const renderer = [
    'scripts/build-social-images.mjs',
    'scripts/social/render.mjs',
    'scripts/social/compositions.mjs',
    'scripts/social/pages.mjs',
  ];
  for (const path of renderer) put(path, path + '\n');
  const rendererSha = sha(
    Buffer.concat(renderer.map((path) => readFileSync(join(directory, path)))),
  );
  const fonts = [400, 600, 700].map((weight) => {
    const font = Buffer.from('reviewed font ' + weight);
    put(`node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff`, font);
    return { weight, family: 'Inter', sha256: sha(font) };
  });
  const original = Buffer.from('reviewed original source');
  put('public/source.webp', original);
  const cover = {
    src: `/og/home-${sha(png).slice(0, 12)}.png`,
    alt: 'Reviewed cover',
    width: 1200,
    height: 630,
    type: 'image/png',
    sha256: sha(png),
    bytes: png.length,
  };
  put('public' + cover.src, png);
  const manifest = {
    version: 1,
    width: 1200,
    height: 630,
    type: 'image/png',
    pages: { '/': cover },
  };
  const provenance = {
    version: 1,
    fonts,
    pages: {
      home: {
        route: '/',
        rendererSha,
        outputSha256: cover.sha256,
        sources: [{ path: 'public/source.webp', sha256: sha(original) }],
        text: [{ text: 'Reviewed heading', x: 56, y: 170, width: 400, height: 55, size: 59 }],
      },
    },
  };
  const art = [
    {
      webp: '/source.webp',
      published: true,
      indexable: true,
      files: { webp: { sha256: sha(original) } },
    },
  ];
  const save = () => {
    put('data/social-images.json', JSON.stringify(manifest));
    put('data/social-image-provenance.json', JSON.stringify(provenance));
    put('data/art.json', JSON.stringify(art));
  };
  save();
  return {
    directory,
    definitions,
    manifest,
    provenance,
    art,
    put,
    save,
    check: () => verifySocialImages({ root: directory, definitions }),
  };
}

test('all actual reviewed covers and typography retain their verified bytes', () => {
  const before = new Map(
    Object.values(approved.pages).map((cover) => [
      cover.src,
      sha(readFileSync(join(root, 'public', cover.src))),
    ]),
  );
  const result = verifySocialImages({ root });
  assert.equal(result.pages, 26);
  assert.equal(result.status, 'passed');
  for (const [path, hash] of before)
    assert.equal(sha(readFileSync(join(root, 'public', path))), hash);
});
test('builds check approved covers without invoking a platform font renderer', () => {
  const scripts = JSON.parse(readFileSync(join(root, 'package.json'))).scripts;
  assert(scripts.build.includes('node scripts/verify-social-images.mjs'));
  assert(!scripts.build.includes('node scripts/build-social-images.mjs'));
  assert.equal(scripts['social:build'], 'node scripts/build-social-images.mjs');
});
test('a complete approved cover can be verified without Sharp or system fonts', (t) => {
  const f = fixture(t);
  assert.equal(f.check().pages, 1);
});
test('modified output bytes are rejected before publication', (t) => {
  const f = fixture(t);
  const changed = Buffer.from(png);
  changed[changed.length - 1] ^= 1;
  f.put('public' + f.manifest.pages['/'].src, changed);
  assert.throws(f.check, /PNG bytes changed/);
});
test('changed original files and catalog checksums invalidate the review', (t) => {
  const f = fixture(t);
  f.put('public/source.webp', Buffer.from('replacement source'));
  assert.throws(f.check, /image source changed/);
  f.provenance.pages.home.sources[0].sha256 = sha(Buffer.from('replacement source'));
  f.save();
  assert.throws(f.check, /original artwork checksum differs/);
});
test('renderer or font updates require new approved provenance', (t) => {
  const f = fixture(t);
  f.put('scripts/social/render.mjs', 'changed renderer');
  assert.throws(f.check, /renderer changed/);
  const other = fixture(t);
  other.put('node_modules/@fontsource/inter/files/inter-latin-700-normal.woff', 'changed font');
  assert.throws(other.check, /font changed/);
});
test('missing routes, stale descriptions and unpublished sources fail closed', (t) => {
  const f = fixture(t);
  assert.throws(
    () =>
      verifySocialImages({
        root: f.directory,
        definitions: [...f.definitions, { key: 'new-page', route: '/new-page/', alt: 'New page' }],
      }),
    /routes require reviewed covers/,
  );
  f.manifest.pages['/'].alt = 'Old description';
  f.save();
  assert.throws(f.check, /approved description changed/);
  f.manifest.pages['/'].alt = 'Reviewed cover';
  f.art[0].published = false;
  f.save();
  assert.throws(f.check, /unpublished artwork/);
});
test('the tiny missing-glyph metrics observed on the Linux host are rejected', (t) => {
  const f = fixture(t);
  f.provenance.pages.home.text[0].height = 3;
  f.save();
  assert.throws(f.check, /font metrics indicate missing glyphs/);
});
test('invalid PNG dimensions and off-canvas type are rejected', (t) => {
  const f = fixture(t);
  f.provenance.pages.home.text[0].x = 1190;
  f.save();
  assert.throws(f.check, /text outside cover/);
  f.provenance.pages.home.text[0].x = 56;
  const changed = Buffer.from(png);
  changed.writeUInt32BE(1, 16);
  f.manifest.pages['/'].sha256 = sha(changed);
  f.manifest.pages['/'].src = `/og/home-${sha(changed).slice(0, 12)}.png`;
  f.provenance.pages.home.outputSha256 = sha(changed);
  f.put('public' + f.manifest.pages['/'].src, changed);
  f.save();
  assert.throws(f.check);
});
test('source traversal and symlinks outside public cannot enter an approved cover', (t) => {
  const f = fixture(t);
  f.provenance.pages.home.sources[0].path = 'public/../private.webp';
  f.save();
  assert.throws(f.check, /source segments/);
  f.provenance.pages.home.sources[0].path = 'public/source.webp';
  f.save();
  rmSync(join(f.directory, 'public/source.webp'));
  f.put('private.webp', 'reviewed original source');
  symlinkSync(join(f.directory, 'private.webp'), join(f.directory, 'public/source.webp'));
  assert.throws(f.check, /source escapes public/);
});
