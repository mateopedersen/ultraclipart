import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { parseArgs } from 'node:util';
import { validateEditorSource } from '../src/lib/artwork-source.ts';
import { validateBatch } from './r2/plan.mjs';

// The reviewed intake is local; the ZIP and original binaries are never committed.
const root = resolve(import.meta.dirname, '..');
const { values } = parseArgs({
  options: { topic: { type: 'string' }, catalog: { type: 'string', default: 'data/art.json' } },
});
const topic = values.topic;
if (!topic || !/^[a-z][a-z0-9-]*$/.test(topic)) throw new Error('A safe topic slug is required');
const stage = join(root, 'work/imports', topic);
const createdAt = new Date().toISOString();
const intakeDate = createdAt.slice(0, 10);
const collection = `owner-${topic}-${intakeDate}`;
const read = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [metadata, inspected, preflight, catalog] = await Promise.all([
  read(join(root, `data/${topic}-metadata.json`)),
  read(join(stage, 'inspection.json')),
  read(join(stage, 'preflight.json')),
  read(join(root, values.catalog)),
]);
if (preflight.status !== 'PASS' || preflight.pairs !== 50 || !preflight.allPairsVisuallyMatched)
  throw new Error('Fifty independently rendered, CMYK-verified PDF/WebP pairs are required');
if (
  metadata.length !== 50 ||
  inspected.length !== 50 ||
  new Set(metadata.map((x) => x.id)).size !== 50
)
  throw new Error('Expected 50 unique IDs');
const hash = (body) => createHash('sha256').update(body).digest('hex');
const target = join(root, 'public/catalog', topic);
await mkdir(target, { recursive: true });
const imported = [],
  batch = [];
for (const meta of metadata) {
  const inspection = inspected.find((x) => x.id === meta.id);
  const proof = preflight.rows.find((x) => x.id === meta.id);
  if (!inspection || proof?.status !== 'PASS' || proof.pairedWebp !== meta.id)
    throw new Error(`Unverified pairing: ${meta.id}`);
  if (!/^[a-z0-9-]+$/.test(meta.id)) throw new Error('Unsafe ID');
  const { width, height } = inspection.webp;
  if (proof.sha256 !== inspection.pdf.sha256 || proof.webpSha256 !== inspection.webp.sha256)
    throw new Error('Intake proof no longer matches source');
  const item = {
    ...meta,
    topic,
    orientation: width === height ? 'Square' : width > height ? 'Landscape' : 'Portrait',
    width,
    height,
    sourceType: 'raster',
    svg: null,
    sourceCollection: collection,
    provenance: 'Owner-supplied collection; original PDF and WebP bytes preserved.',
    productionMethod: 'owner-supplied',
    licenseStatus: 'OWNER_APPROVED_PERSONAL_EDUCATIONAL_ONLY',
    license:
      'Free personal and educational use. Commercial use and resale as clipart are prohibited.',
    licenseApprovedAt: intakeDate,
    reviewStatus: 'FORMAT_AND_PAIR_REVIEW_PASSED',
    published: true,
    indexable: true,
    createdAt,
    revision: 1,
    formats: ['WEBP', 'PDF'],
    printProfile: proof.images[0].profile,
    pdfColorSpace: proof.images[0].colorSpace || 'ICC-based CMYK',
    pdfPage: proof.pagePoints.map((n) => (n / 72).toFixed(3)).join(' × ') + ' in',
    alpha: true,
    files: {},
  };
  for (const kind of ['webp', 'pdf']) {
    const source = join(stage, kind, `${meta.id}.${kind}`),
      body = await readFile(source);
    if (body.length !== inspection[kind].bytes || hash(body) !== inspection[kind].sha256)
      throw new Error(`Original changed after inspection: ${meta.id}/${kind}`);
    await copyFile(source, join(target, `${meta.id}.${kind}`));
  }
  await sharp(join(target, `${meta.id}.webp`))
    .resize(440, 440, { fit: 'inside', withoutEnlargement: true })
    .toColourspace('srgb')
    .webp({ quality: 94, alphaQuality: 100, effort: 6 })
    .toFile(join(target, `${meta.id}-thumb.webp`));
  const preview = await sharp(join(target, `${meta.id}-thumb.webp`)).metadata();
  if (
    Math.max(preview.width, preview.height) !== Math.min(440, Math.max(width, height)) ||
    Math.abs(preview.width / preview.height - width / height) > 0.01 ||
    !preview.hasAlpha
  )
    throw new Error('Invalid thumbnail dimensions or transparency');
  for (const kind of ['pdf', 'webp', 'thumb']) {
    const name = `${meta.id}${kind === 'thumb' ? '-thumb.webp' : '.' + kind}`;
    const body = await readFile(join(target, name)),
      sha256 = hash(body);
    item[kind] = `/catalog/${topic}/${name}`;
    item.files[kind] = { bytes: body.length, sha256 };
    const representation = kind === 'thumb' ? 'thumbnail' : kind;
    batch.push({
      assetId: meta.id,
      sourceType: 'raster',
      kind: representation,
      bucket: 'ultraclipart-media',
      jurisdiction: 'default',
      key: `${topic}/${meta.id}.${representation}.${sha256.slice(0, 16)}.${kind === 'thumb' ? 'webp' : kind}`,
      path: `public/catalog/${topic}/${name}`,
      bytes: body.length,
      sha256,
    });
  }
  validateEditorSource(item);
  imported.push(item);
}
validateBatch(batch);
const first =
  JSON.parse(await readFile(join(root, 'data/collection-copy.json'), 'utf8'))[topic]?.featured ||
  [];
imported.sort(
  (a, b) =>
    (first.indexOf(a.id) < 0 ? 99 : first.indexOf(a.id)) -
    (first.indexOf(b.id) < 0 ? 99 : first.indexOf(b.id)),
);
const next = [...catalog.filter((x) => x.sourceCollection !== collection), ...imported];
if (new Set(next.map((x) => x.id)).size !== next.length) throw new Error('Catalog ID collision');
await writeFile(join(root, `work/art.${topic}.next.json`), JSON.stringify(next, null, 2) + '\n');
await writeFile(join(root, `work/${topic}.r2-batch.json`), JSON.stringify(batch, null, 2) + '\n');
await writeFile(
  join(root, `data/${topic}-review.json`),
  JSON.stringify(
    {
      collection: topic,
      count: 50,
      reviewDate: intakeDate,
      originalPairsUnchanged: true,
      screenReview: 'PASS',
      physicalPrintProof: false,
      reviewerType: 'AI_AGENT_NOT_HUMAN',
      scope:
        'All 50 WebP compositions and all 50 independently rendered CMYK PDF pages; paired visual matching and byte integrity.',
      files: imported.map((x) => ({ id: x.id, files: x.files })),
    },
    null,
    2,
  ) + '\n',
);
await copyFile(join(stage, 'preflight.json'), join(root, `data/${topic}-preflight.json`));
console.log({
  drawings: imported.length,
  catalog: next.length,
  objects: batch.length,
  originalBytes: inspected.reduce((n, x) => n + x.pdf.bytes + x.webp.bytes, 0),
  thumbnailBytes: imported.reduce((n, x) => n + x.files.thumb.bytes, 0),
  publication: 'not yet changed',
});
