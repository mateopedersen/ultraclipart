import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateEditorSource } from '../src/lib/artwork-source.ts';
import { validateBatch } from './r2/plan.mjs';
import { replacementFor, mergeGeneratedWave } from './replacement-contract.mjs';

const root = resolve(import.meta.dirname, '..');
const wave = process.argv[2];
if (!/^wave_\d{3}$/.test(wave ?? '')) throw new Error('A valid wave ID is required');
const read = async (path) => JSON.parse(await readFile(join(root, path), 'utf8'));
const [report, catalog, plan] = await Promise.all([
  read(`work/production/${wave}/raster-report.json`),
  read('data/art.json'),
  read(`data/waves/${wave}-plan.json`),
]);
if (
  report.wave !== wave ||
  report.status !== 'FORMAT_PREFLIGHT_PASSED' ||
  report.screenReview !== 'PASS' ||
  report.actualExportedDrawings !== plan.items.length ||
  report.artworks.length !== plan.items.length ||
  plan.items.length > 50
)
  throw new Error('A complete rendered and visually reviewed wave is required');
const hash = (body) => createHash('sha256').update(body).digest('hex');
const replacementReview = plan.replacementReview ? await read(plan.replacementReview) : null;
const createdAt = new Date().toISOString();
const batch = [],
  imported = [];
const target = join(root, 'public/catalog', wave);
await mkdir(target, { recursive: true });
for (const row of report.artworks) {
  const meta = plan.items.find((item) => item.id === row.id);
  if (
    !meta ||
    row.state !== 'FORMAT_PREFLIGHT_PASSED' ||
    !row.webpExactRgba ||
    !row.pdfAlphaExact ||
    !(
      row.nativeResolutionPreserved ||
      (row.webpNativeResolutionPreserved &&
        row.pdfAt300Ppi &&
        row.pdfWidth > 0 &&
        row.pdfHeight > 0 &&
        row.pdfWidth <= row.width &&
        row.pdfHeight <= row.height)
    ) ||
    row.pairMeanRgbDifference >= 18
  )
    throw new Error('Incomplete source verification');
  if (hash(await readFile(join(root, meta.source))) !== row.sourceSha256)
    throw new Error('Master image changed after preflight');
  for (const [key, value] of Object.entries(meta))
    if (JSON.stringify(row[key]) !== JSON.stringify(value))
      throw new Error(`Artwork metadata changed after preflight: ${row.id}/${key}`);
  if ([...catalog, ...imported].some((item) => item.files.webp.sha256 === row.files.webp.sha256))
    throw new Error(`Repeated artwork download rejected: ${row.id}`);
  const prior = replacementFor(plan, meta, catalog, replacementReview);
  if (
    prior &&
    (row.files.webp.sha256 === prior.files.webp.sha256 ||
      row.files.pdf.sha256 === prior.files.pdf.sha256)
  )
    throw new Error('Replacement must contain a new composition');
  const item = {
    id: row.id,
    topic: plan.topic,
    title: meta.title,
    alt: meta.alt,
    description: meta.description,
    color: meta.color,
    style: meta.style,
    width: row.width,
    height: row.height,
    orientation:
      row.width === row.height ? 'Square' : row.width > row.height ? 'Landscape' : 'Portrait',
    sourceType: 'raster',
    svg: null,
    sourceCollection: wave,
    productionMethod: 'generated-raster',
    provenance:
      'Original built-in image generation; native source retained with prompt and export evidence.',
    licenseStatus: 'OWNER_APPROVED_PERSONAL_EDUCATIONAL_ONLY',
    license:
      'Free personal and educational use. Commercial use and resale as clipart are prohibited.',
    licenseApprovedAt: '2026-10-23',
    reviewStatus: 'FORMAT_AND_PAIR_REVIEW_PASSED',
    published: true,
    indexable: true,
    createdAt,
    revision: prior ? prior.revision + 1 : 1,
    ...(prior
      ? {
          replacesArtwork: {
            sourceCollection: prior.sourceCollection,
            revision: prior.revision,
            webpSha256: prior.files.webp.sha256,
            pdfSha256: prior.files.pdf.sha256,
            reason: 'REPLACE_NEAR_COMPOSITION',
          },
        }
      : {}),
    formats: ['WEBP', 'PDF'],
    printProfile: row.image.profile,
    pdfColorSpace: row.image.colorSpace,
    pdfPage:
      [row.pdfWidth ?? row.width, row.pdfHeight ?? row.height]
        .map((n) => (n / 300).toFixed(3))
        .join(' × ') + ' in',
    alpha: true,
    files: {},
  };
  for (const kind of ['pdf', 'webp', 'thumb']) {
    const source = row.files[kind];
    const body = await readFile(join(root, source.path));
    if (body.length !== source.bytes || hash(body) !== source.sha256)
      throw new Error(`Changed export: ${row.id}/${kind}`);
    const filename = `${row.id}${kind === 'thumb' ? '-thumb.webp' : '.' + kind}`;
    await copyFile(join(root, source.path), join(target, filename));
    item[kind] = `/catalog/${wave}/${filename}`;
    item.files[kind] = { bytes: source.bytes, sha256: source.sha256 };
    const representation = kind === 'thumb' ? 'thumbnail' : kind;
    batch.push({
      assetId: row.id,
      sourceType: 'raster',
      kind: representation,
      bucket: 'ultraclipart-media',
      jurisdiction: 'default',
      key: `${plan.topic}/${row.id}.${representation}.${source.sha256.slice(0, 16)}.${kind === 'thumb' ? 'webp' : kind}`,
      path: `public/catalog/${wave}/${filename}`,
      bytes: source.bytes,
      sha256: source.sha256,
    });
  }
  validateEditorSource(item);
  imported.push(item);
}
const next = mergeGeneratedWave(catalog, imported, Boolean(plan.replacementReview));
validateBatch(batch);
await writeFile(join(root, `work/art.${wave}.next.json`), JSON.stringify(next, null, 2) + '\n');
await writeFile(join(root, `work/${wave}.r2-batch.json`), JSON.stringify(batch, null, 2) + '\n');
await writeFile(
  join(root, `data/waves/${wave}.json`),
  JSON.stringify(
    {
      ...report,
      reviewerType: 'AI_AGENT_NOT_HUMAN',
      status: 'AWAITING_CDN',
      createdAt,
      actualExportedDrawings: imported.length,
    },
    null,
    2,
  ) + '\n',
);
console.log({
  imported: imported.length,
  candidateCatalog: next.length,
  objects: batch.length,
  remoteWrites: 0,
});
