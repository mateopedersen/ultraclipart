import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { previewIdentity, previewUrls, readPreviewIndex } from './preview-assets.mjs';

export function collectCompiledMediaReferences(
  text,
  { allowed, localPaths, references, filename },
) {
  for (const match of text.matchAll(/["'](\/[A-Za-z0-9/._-]+)["']/g)) {
    if (localPaths.has(match[1]))
      throw Error(`Production still references local media: ${filename}`);
  }
  const remember = (value) => {
    // RegExp matches may retain their entire multi-megabyte HTML source. Store
    // an independent short string; keep the release check within normal memory.
    if (!references.has(value)) references.add(Buffer.from(value).toString('utf8'));
  };
  for (const match of text.matchAll(/https:\/\/assets\.ultraclipart\.com\/[A-Za-z0-9/._-]+/g)) {
    if (!allowed.has(match[0])) throw Error(`Unverified compiled CDN reference: ${match[0]}`);
    remember(match[0]);
  }
  for (const match of text.matchAll(/\/previews\/p1\/[a-f0-9]{24}-\d+\.webp/g)) remember(match[0]);
}

/** Originals remain verified by readPublication. A screen thumbnail may use its
 * source-bound derivative, but downloadable representations must still appear. */
export function verifyCompiledPublication({ publication, catalog, references, root, directory }) {
  const thumbnails = new Map(catalog.map((item) => [publication.assetUrls[item.id]?.thumb, item]));
  let previews;
  let screenThumbnails = 0;
  for (const url of publication.urls) {
    if (references.has(url)) continue;
    const item = thumbnails.get(url);
    if (item?.published && item.indexable) {
      previews ??= readPreviewIndex(root);
      const preview = previewUrls(item)[440];
      const record = previews[previewIdentity(item)]?.files?.[440];
      if (references.has(preview) && record) {
        const bytes = readFileSync(join(directory, preview));
        if (
          bytes.length !== record.bytes ||
          createHash('sha256').update(bytes).digest('hex') !== record.sha256
        )
          throw Error(`Compiled preview changed after source verification: ${item.id}`);
        screenThumbnails++;
        continue;
      }
    }
    throw Error(`Verified media was omitted from compiled output: ${url}`);
  }
  return { screenThumbnails };
}
