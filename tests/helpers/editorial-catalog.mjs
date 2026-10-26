import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveArtworkCopy } from '../../scripts/artwork-editorial.mjs';

// Browser expectations must use the same approved copy as the rendered catalog.
// Historical release fixtures without an editorial registry retain their own text.
export function readEditorialCatalog(directory) {
  const file = (name) =>
    directory ? resolve(directory, name) : new URL('../../data/' + name, import.meta.url);
  const read = (name) => JSON.parse(readFileSync(file(name), 'utf8'));
  const raw = read('art.json');
  if (!existsSync(file('editorial/reviews.json'))) return raw;
  const reviews = new Map(read('editorial/reviews.json').artworks.map((row) => [row.id, row]));
  return raw.map((item) => ({ ...item, ...resolveArtworkCopy(item, reviews.get(item.id)) }));
}
