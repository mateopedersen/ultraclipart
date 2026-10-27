import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { artwork, manifestFor, digest } from './fixtures/publication.mjs';
import { validatePublication } from '../scripts/publication-policy.mjs';
import { previewIdentity, previewUrls } from '../scripts/preview-assets.mjs';
import {
  collectCompiledMediaReferences,
  verifyCompiledPublication,
} from '../scripts/compiled-publication.mjs';

test('compiled references reject unverified CDN and local source URLs', () => {
  const options = {
    allowed: new Set(),
    localPaths: new Set(['/catalog/private.webp']),
    references: new Set(),
    filename: 'page.html',
  };
  assert.throws(
    () => collectCompiledMediaReferences('<img src="/catalog/private.webp">', options),
    /local media/,
  );
  assert.throws(
    () =>
      collectCompiledMediaReferences(
        '<img src="https://assets.ultraclipart.com/unverified.webp">',
        options,
      ),
    /Unverified/,
  );
});

test('large release scans do not retain complete HTML documents for short image URLs', () => {
  const module = new URL('../scripts/compiled-publication.mjs', import.meta.url).href;
  const result = spawnSync(
    process.execPath,
    [
      '--max-old-space-size=128',
      '--input-type=module',
      '-e',
      `
    import { collectCompiledMediaReferences } from ${JSON.stringify(module)};
    const options = { allowed: new Set(), localPaths: new Set(), references: new Set(), filename: 'sample.html' };
    for (let i = 0; i < 120; i++) {
      const url = '/previews/p1/' + i.toString(16).padStart(24, '0') + '-440.webp';
      collectCompiledMediaReferences('<img src="' + url + '"><p>' + 'x'.repeat(2 * 1024 * 1024) + '</p>', options);
    }
    if (options.references.size !== 120) throw Error('Missing references');
  `,
    ],
    { encoding: 'utf8', timeout: 30000, maxBuffer: 8192 },
  );
  assert.equal(result.status, 0, result.stderr);
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'uc-compiled-publication-'));
  const bodies = new Map();
  const item = { ...artwork('sample-artwork', bodies), published: true, indexable: true };
  const publication = validatePublication(manifestFor([item]), [item], (path) => bodies.get(path));
  const preview = previewUrls(item)[440];
  const bytes = Buffer.from('verified screen derivative');
  const directory = join(root, 'dist');
  mkdirSync(dirname(join(directory, preview)), { recursive: true });
  mkdirSync(join(root, '.astro'));
  writeFileSync(join(directory, preview), bytes);
  const index = {
    [previewIdentity(item)]: { files: { 440: { bytes: bytes.length, sha256: digest(bytes) } } },
  };
  const save = () => writeFileSync(join(root, '.astro/preview-assets.json'), JSON.stringify(index));
  save();
  const references = new Set(
    publication.urls.filter((url) => url !== publication.assetUrls[item.id].thumb),
  );
  references.add(preview);
  return { root, directory, catalog: [item], publication, references, item, preview, index, save };
}

test('a rendered source-bound screen derivative can replace only its CDN thumbnail', () => {
  const f = fixture();
  try {
    assert.deepEqual(verifyCompiledPublication(f), { screenThumbnails: 1 });
    f.references.add(f.publication.assetUrls[f.item.id].thumb);
    assert.deepEqual(verifyCompiledPublication(f), { screenThumbnails: 0 });
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test('missing originals, unrendered previews and changed sources still block production', () => {
  for (const mutate of [
    (f) => f.references.delete(f.publication.assetUrls[f.item.id].webp),
    (f) => f.references.delete(f.publication.assetUrls[f.item.id].pdf),
    (f) => f.references.delete(f.publication.assetUrls[f.item.id].svg),
    (f) => f.references.delete(f.preview),
    (f) => {
      f.item.files.thumb.sha256 = 'f'.repeat(64);
    },
    (f) => {
      f.item.published = false;
    },
    (f) => {
      delete f.index[previewIdentity(f.item)];
      f.save();
    },
    (f) => writeFileSync(join(f.directory, f.preview), 'changed derivative'),
  ]) {
    const f = fixture();
    try {
      mutate(f);
      assert.throws(() => verifyCompiledPublication(f), /omitted|changed/);
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  }
});
