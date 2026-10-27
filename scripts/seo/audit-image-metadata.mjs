import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { readReviewedImportCatalog } from '../reviewed-imports.mjs';
const root = resolve(import.meta.dirname, '../..');
const built = resolve(root, process.env.METADATA_BUILD_DIR || 'dist');
const artwork = readReviewedImportCatalog(root).filter((a) => a.published && a.indexable);
const reviews = JSON.parse(
  readFileSync(join(root, 'data/image-metadata-reviews.json'), 'utf8'),
).artwork;
const decode = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, name) => {
    if (name.startsWith('#'))
      return String.fromCodePoint(
        parseInt(
          name.slice(name[1].toLowerCase() === 'x' ? 2 : 1),
          name[1].toLowerCase() === 'x' ? 16 : 10,
        ),
      );
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[name.toLowerCase()];
  });
const attribute = (tag, name) => decode(tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || '');
const rows = [],
  errors = [];
const visited = new Set(),
  imageAttributeErrors = [];
let informativeImageInstances = 0;
function auditImageAttributes(file, html) {
  visited.add(file);
  for (const match of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = match[0];
    if (!/\balt="/.test(tag))
      imageAttributeErrors.push({
        file,
        src: attribute(tag, 'src'),
        field: 'missing alt attribute',
      });
    else if (attribute(tag, 'alt').trim()) {
      informativeImageInstances++;
      if (!attribute(tag, 'title').trim())
        imageAttributeErrors.push({
          file,
          src: attribute(tag, 'src'),
          field: 'missing image title',
        });
    }
  }
}
for (const item of artwork) {
  const file = join(built, 'art', item.id, 'index.html');
  const failed = [];
  if (!existsSync(file)) {
    errors.push({ id: item.id, fields: ['missing artwork HTML'] });
    continue;
  }
  const html = readFileSync(file, 'utf8');
  auditImageAttributes(file, html);
  const preview = html.match(/<div\b[^>]*id="art-preview"[^>]*>\s*(<img\b[^>]*>)/)?.[1] || '';
  if (attribute(preview, 'alt') !== item.alt) failed.push('image alt');
  if (attribute(preview, 'title') !== item.title) failed.push('image title');
  const heading = decode(
    (html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '').replace(/<[^>]+>/g, '').trim(),
  );
  if (heading !== item.title) failed.push('H1');
  const meta = html.match(/<meta\b(?=[^>]*\bname="description")[^>]*>/)?.[0] || '';
  if (attribute(meta, 'content') !== item.description) failed.push('meta description');
  let schema;
  for (const match of html.matchAll(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    try {
      const value = JSON.parse(match[1]);
      if (value['@type'] === 'ImageObject') schema = value;
    } catch {
      failed.push('invalid image JSON-LD');
    }
  }
  if (schema?.name !== item.title || schema?.description !== item.description)
    failed.push('image schema');
  if (failed.length) errors.push({ id: item.id, fields: failed });
  rows.push({
    id: item.id,
    title: item.title,
    alt: item.alt,
    description: item.description,
    sourceSha256: item.files.webp.sha256,
    visuallyReviewedThisBatch: !!reviews[item.id],
    passed: !failed.length,
  });
}
function auditRemainingPages(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) auditRemainingPages(file);
    else if (entry.name.endsWith('.html') && !visited.has(file))
      auditImageAttributes(file, readFileSync(file, 'utf8'));
  }
}
auditRemainingPages(built);
const out = join(root, 'reports/image-information');
mkdirSync(out, { recursive: true });
const summary = {
  date: new Date().toISOString(),
  buildDirectory: built,
  checked: rows.length,
  errors,
  checkedHtmlPages: visited.size,
  informativeImageInstances,
  imageAttributeErrors,
  scope:
    'Every eligible artwork HTML: exact image alt/title, H1, meta description and ImageObject fields compared with its own catalog record. This is not a visual inspection of every artwork.',
  visualReviewsThisBatch: Object.keys(reviews).length,
};
writeFileSync(join(out, 'all-artwork-html.json'), JSON.stringify(summary, null, 2));
writeFileSync(
  join(out, 'all-artwork-metadata.csv'),
  '\ufeffID,Title,Alt,Description,Source SHA-256,Visual review in this batch,HTML result\n' +
    rows
      .map((r) =>
        [
          r.id,
          r.title,
          r.alt,
          r.description,
          r.sourceSha256,
          r.visuallyReviewedThisBatch ? 'Yes' : 'No',
          r.passed ? 'Passed' : 'Failed',
        ]
          .map((s) => '"' + String(s).replaceAll('"', '""') + '"')
          .join(','),
      )
      .join('\n'),
);
console.log(JSON.stringify(summary));
if (errors.length || imageAttributeErrors.length || rows.length !== artwork.length)
  process.exitCode = 1;
