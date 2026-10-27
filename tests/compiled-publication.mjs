import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { artwork, manifestFor, digest } from './fixtures/publication.mjs';
import { validatePublication } from '../scripts/publication-policy.mjs';
import { previewIdentity, previewUrls } from '../scripts/preview-assets.mjs';
import { verifyCompiledPublication } from '../scripts/compiled-publication.mjs';

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
