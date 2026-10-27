import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { previewIdentity } from './preview-assets.mjs';
const catalog = JSON.parse(readFileSync('data/art.json')).filter(
  (item) => item.published && item.indexable,
);
const cache = JSON.parse(readFileSync('.astro/preview-assets.json'));
const entries = {};
let files = 0;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
for (const item of catalog) {
  const key = previewIdentity(item),
    record = cache[key];
  if (!record) throw Error('Missing generated preview ' + item.id);
  for (const kind of ['thumb', 'webp'])
    if (hash(readFileSync('public' + item[kind])) !== item.files[kind].sha256)
      throw Error('Original source changed ' + item.id);
  const verified = {};
  for (const [width, file] of Object.entries(record.files)) {
    const bytes = readFileSync(`public/previews/p1/${key}-${width}.webp`);
    if (bytes.length !== file.bytes || hash(bytes) !== file.sha256)
      throw Error('Derivative changed ' + item.id + '/' + width);
    const { mtime, ...stable } = file;
    verified[width] = stable;
    files++;
  }
  entries[key] = { files: verified };
}
const path = 'data/preview-cache-index.json',
  temporary = path + '.tmp';
writeFileSync(temporary, JSON.stringify({ schema: 1, encoder: 'p1', entries }));
renameSync(temporary, path);
console.log(JSON.stringify({ sources: catalog.length, files, status: 'passed' }));
