import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import {
  metadataSignature,
  reviewContextSignature,
  sourceSignature,
} from './artwork-editorial.mjs';
import { validateLocalAssetPath } from './publication-policy.mjs';

// Prepare evidence and an EMPTY review. This command never approves or writes public copy.
const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--topic', '--offset', '--limit'].includes(args[i]) || args[i + 1] === undefined)
    throw new Error(
      'Usage: node scripts/prepare-editorial-review.mjs [--topic slug] [--offset 0] [--limit 25]',
    );
  options[args[i].slice(2)] = args[i + 1];
}
const offset = Number(options.offset ?? 0),
  limit = Number(options.limit ?? 25);
if (
  !Number.isSafeInteger(offset) ||
  offset < 0 ||
  !Number.isSafeInteger(limit) ||
  limit < 1 ||
  limit > 25
)
  throw new Error('Offset must be nonnegative and limit must be 1–25');
if (options.topic && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.topic))
  throw new Error('Invalid topic');
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const reviews = new Map(read('data/editorial/reviews.json').artworks.map((row) => [row.id, row]));
const candidates = read('data/art.json').filter((item) => {
  if (!item.published || !item.indexable || (options.topic && item.topic !== options.topic))
    return false;
  const prior = reviews.get(item.id);
  return (
    !prior ||
    prior.sourceSha256 !== sourceSignature(item) ||
    prior.imageSha256 !== item.files.webp.sha256 ||
    prior.inputMetadataSha256 !== metadataSignature(item) ||
    prior.inputContextSha256 !== reviewContextSignature(item)
  );
});
const items = candidates.slice(offset, offset + limit);
if (!items.length) throw new Error('No pending images in this selection');
const hash = (body) => createHash('sha256').update(body).digest('hex');
const key = hash(
  JSON.stringify(
    items.map((item) => [
      item.id,
      sourceSignature(item),
      metadataSignature(item),
      reviewContextSignature(item),
    ]),
  ),
).slice(0, 12);
const directory = resolve(root, 'work/editorial-review', `${options.topic ?? 'pending'}-${key}`);
mkdirSync(directory, { recursive: true });
const draftPath = resolve(directory, 'review.json');
const sheet = resolve(directory, 'images.png');
const draft = {
  schema: 1,
  status: 'pending-visual-review',
  instructions:
    'Inspect every numbered image and the original when details are unclear. Write image-specific title, alt and description, record observed features and primary references. Do not mark unseen pictures reviewed. Do not infer details or identities from filenames. New copy is applied only after source-bound validation.',
  artworks: [],
};
const composites = [];
for (let index = 0; index < items.length; index++) {
  const item = items[index];
  validateLocalAssetPath(item.webp);
  const source = resolve(root, 'public' + item.webp);
  const bytes = readFileSync(source);
  if (hash(bytes) !== item.files.webp.sha256) throw new Error(`Changed image bytes: ${item.id}`);
  const left = (index % 5) * 300,
    top = Math.floor(index / 5) * 340;
  composites.push({
    input: await sharp(bytes)
      .resize(290, 290, { fit: 'contain', background: '#fff' })
      .flatten({ background: '#fff' })
      .png()
      .toBuffer(),
    left: left + 5,
    top: top + 5,
  });
  composites.push({
    input: Buffer.from(
      `<svg width="300" height="40"><rect width="300" height="40" fill="white"/><text x="150" y="28" text-anchor="middle" font-family="Arial" font-size="22">${index + 1}</text></svg>`,
    ),
    left,
    top: top + 297,
  });
  draft.artworks.push({
    number: index + 1,
    id: item.id,
    status: 'pending-visual-review',
    sourceSha256: sourceSignature(item),
    imageSha256: item.files.webp.sha256,
    inputMetadataSha256: metadataSignature(item),
    inputContextSha256: reviewContextSignature(item),
    inspectedImage: item.webp,
    originalPath: source,
    reviewedAt: null,
    observations: [],
    references: [],
    copy: { title: '', alt: '', description: '' },
  });
}
await sharp({
  create: {
    width: 1500,
    height: Math.ceil(items.length / 5) * 340,
    channels: 3,
    background: '#dae4f1',
  },
})
  .composite(composites)
  .png()
  .toFile(sheet);
// Preserve an existing reviewer draft, including unfinished edits, on repeated preparation.
if (!existsSync(draftPath)) writeFileSync(draftPath, JSON.stringify(draft, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      pendingInSelection: candidates.length,
      prepared: items.length,
      sheet,
      draft: draftPath,
      status: 'not-approved',
    },
    null,
    2,
  ),
);
