import { readFileSync, writeFileSync, mkdirSync, copyFileSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { validateEditorSource } from '../src/lib/artwork-source.ts';
import { validateBatch } from './r2/plan.mjs';
import { validateRecoveredCollection } from './recovered-collection.mjs';

const root = resolve(import.meta.dirname, '..');
const { values } = parseArgs({
  options: { intake: { type: 'string' }, catalog: { type: 'string', default: 'data/art.json' } },
});
if (!values.intake) throw new Error('--intake is required');
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const intake = read(values.intake);
const rows = validateRecoveredCollection(intake, (path) => {
  const file = realpathSync(resolve(root, path));
  if (!file.startsWith(join(root, 'work/technology-intake/')))
    throw new Error('Recovery source escapes intake');
  return readFileSync(file);
});
const topic = intake.topic,
  collection = 'technology-recovery-2026-10-24';
const catalog = read(values.catalog),
  existing = new Set(catalog.map((item) => item.id));
if (rows.some((row) => existing.has(row.id)))
  throw new Error('Recovery must not overwrite an existing artwork');
const createdAt = new Date().toISOString(),
  target = join(root, 'public/catalog', topic);
mkdirSync(target, { recursive: true });
const added = [],
  batch = [];
for (const row of rows) {
  const { width, height } = row;
  const item = {
    id: row.id,
    topic,
    title: row.title,
    alt: row.alt,
    description: row.description,
    color: row.color,
    style: row.style,
    width,
    height,
    orientation: width === height ? 'Square' : width > height ? 'Landscape' : 'Portrait',
    sourceType: 'raster',
    svg: null,
    sourceCollection: collection,
    productionMethod: row.productionMethod,
    provenance:
      row.productionMethod === 'owner-supplied'
        ? 'Owner-supplied PNG and WebP pair; original WebP retained, PNG converted to independently verified CMYK PDF.'
        : 'Original built-in image generation; source and prompt retained, lossless WebP and verified CMYK PDF exported.',
    licenseStatus: 'OWNER_APPROVED_PERSONAL_EDUCATIONAL_ONLY',
    license:
      'Free personal and educational use. Commercial use and resale as clipart are prohibited.',
    licenseApprovedAt: '2026-10-24',
    reviewStatus: 'FORMAT_AND_PAIR_REVIEW_PASSED',
    published: true,
    indexable: true,
    createdAt,
    revision: 1,
    formats: ['WEBP', 'PDF'],
    printProfile: row.print.profile,
    pdfColorSpace: row.print.colorSpace,
    pdfPage:
      [row.print.width, row.print.height].map((n) => (n / 300).toFixed(3)).join(' × ') + ' in',
    alpha: true,
    files: {},
  };
  for (const kind of ['webp', 'pdf', 'thumb']) {
    const file = row.files[kind],
      extension = kind === 'pdf' ? 'pdf' : 'webp';
    const name = `${row.id}${kind === 'thumb' ? '-thumb' : ''}.${extension}`;
    copyFileSync(resolve(root, file.path), join(target, name));
    item[kind] = `/catalog/${topic}/${name}`;
    item.files[kind] = { bytes: file.bytes, sha256: file.sha256 };
    const representation = kind === 'thumb' ? 'thumbnail' : kind;
    batch.push({
      assetId: row.id,
      sourceType: 'raster',
      kind: representation,
      bucket: 'ultraclipart-media',
      jurisdiction: 'default',
      key: `${topic}/${row.id}.${representation}.${file.sha256.slice(0, 16)}.${extension}`,
      path: `public/catalog/${topic}/${name}`,
      ...item.files[kind],
    });
  }
  validateEditorSource(item);
  added.push(item);
}
validateBatch(batch);
const save = (path, data) => writeFileSync(join(root, path), JSON.stringify(data, null, 2) + '\n');
save(`work/art.${topic}.next.json`, [...catalog, ...added]);
save(`work/${topic}.r2-batch.json`, batch);
save(`data/${topic}-recovery-review.json`, {
  schema: 1,
  collection,
  topic,
  count: rows.length,
  reviewedAt: createdAt,
  reviewerType: 'AI_AGENT_NOT_HUMAN',
  physicalPrintProof: false,
  originalPdfsProvided: false,
  originalWebpBytesPreserved: true,
  files: rows.map(({ id, productionMethod, print, files }) => ({
    id,
    productionMethod,
    print,
    sourcePngSha256: files.png.sha256,
    proofSha256: files.proof.sha256,
    webp: added.find((item) => item.id === id).files.webp,
    pdf: added.find((item) => item.id === id).files.pdf,
  })),
});
console.log(
  JSON.stringify({
    stagedArtworks: added.length,
    objects: batch.length,
    publicationChanged: false,
  }),
);
