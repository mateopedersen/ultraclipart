import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
  renameSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { setTimeout as delay } from 'node:timers/promises';
const waitForReview = process.argv.includes('--wait-for-review');
if (process.argv.slice(2).some((x) => x !== '--wait-for-review'))
  throw Error('Unknown intake option');
import { validateBatch } from './r2/plan.mjs';
import {
  packageContexts,
  packageCollectionCopy,
  packageMetadata,
  packageDiscovery,
} from './remaining-thirty-one-copy.mjs';

const root = resolve(import.meta.dirname, '..');
const stage = join(root, 'work/imports/remaining-thirty-one');
const collection = 'owner-remaining-thirty-one-2026-10-25';
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const hash = (body) => createHash('sha256').update(body).digest('hex');
const save = (p, value) => {
  const tmp = p + '.tmp';
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  renameSync(tmp, p);
};
const mapping = read(join(stage, 'topic-map.json'));
if (
  mapping.length !== 31 ||
  mapping.some((m) => m.folder !== m.topic + '-clipart' || m.pairs !== 50) ||
  [...mapping.map((m) => m.topic)].sort().join() !== Object.keys(packageContexts).sort().join()
)
  throw Error('Unexpected package mapping');
async function reviewedTopic(topic) {
  const deadline = Date.now() + 8 * 60 * 60_000;
  while (true) {
    const review = existsSync(join(stage, 'screen-review.json'))
      ? read(join(stage, 'screen-review.json'))
      : null;
    if (review?.topics?.[topic] === 'PASS') {
      const sheets = review.sheets.filter((x) => x.topic === topic);
      if (sheets.length !== 2) throw Error('Two visual review sheets required: ' + topic);
      for (const sheet of sheets) {
        const path = resolve(stage, sheet.file);
        if (!path.startsWith(stage + '/') || hash(readFileSync(path)) !== sheet.sha256)
          throw Error('Visual evidence changed: ' + topic);
      }
      return review;
    }
    if (!waitForReview || Date.now() > deadline) throw Error('Visual review pending: ' + topic);
    await delay(5000);
  }
}
const extraction = read(join(stage, 'extraction.json'));
const discoveryReview = read(join(stage, 'discovery-review.json'));
if (discoveryReview.status !== 'PASS' || !discoveryReview.reviewedFromActualPixels)
  throw Error('Cute discovery needs a review of the actual pictures');
const originalArt = read(join(root, 'data/art.json'));
if (originalArt.some((x) => x.sourceCollection === collection))
  throw Error('This expansion is already published; preserve its history');
const extra = read(join(root, 'data/extra-topics.json'));
const baseTopics = read(join(root, 'data/topics.json'));
const secondary = read(join(root, 'data/topic-clusters.json'));
const topics = [...baseTopics.topics, ...extra];
// Existing subjects also belong in the newly available browsing groups.
for (const [slug, cluster] of [
  ['hat', 'Clothing & accessories'],
  ['earth', 'Space & science'],
  ['electric-car', 'Transport & vehicles'],
]) {
  if (topics.some((topic) => topic.slug === slug))
    secondary[slug] = [...new Set([...(secondary[slug] ?? []), cluster])];
}
let nextTopicId = Math.max(...topics.map((topic) => topic.id)) + 1;
const copy = read(join(root, 'data/collection-copy.json'));
const imported = [],
  proof = [];

async function colorOf(path, id) {
  if (/black-and-white|silhouette/.test(id)) return 'Black';
  const { data } = await sharp(path)
    .resize(64, 64, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const counts = {};
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 192) continue;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]],
      max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    const color =
      max - min < 22
        ? max > 218
          ? 'White'
          : max < 65
            ? 'Black'
            : 'Gray'
        : r > b * 1.2 && g > b * 1.18
          ? r > g * 1.7
            ? 'Red'
            : g > r * 0.88
              ? 'Yellow'
              : max < 200 || min > 45
                ? 'Brown'
                : 'Orange'
          : r > g * 1.3 && b > g * 1.2
            ? r > b * 1.15
              ? 'Pink'
              : 'Purple'
            : g > r && g > b
              ? 'Green'
              : b > r
                ? 'Blue'
                : 'Red';
    counts[color] = (counts[color] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Gray';
}

for (const { topic, folder } of mapping) {
  const review = await reviewedTopic(topic);
  const preflight = read(join(stage, 'review', topic, 'preflight.json'));
  if (
    preflight.status !== 'FORMAT_PASSED' ||
    !preflight.allPairsVisuallyMatched ||
    preflight.rows.length !== 50 ||
    review.topics[topic] !== 'PASS'
  )
    throw Error('Technical and visual review required: ' + topic);
  const target = join(root, 'public/catalog', topic);
  mkdirSync(target, { recursive: true });
  const items = [],
    batch = [];
  let cursor = 0;
  async function worker() {
    while (cursor < preflight.rows.length) {
      const checked = preflight.rows[cursor++],
        { id, width, height } = checked;
      if (
        !/^[a-z0-9-]+$/.test(id) ||
        checked.pairedWebp !== id ||
        !checked.pdfAlphaExact ||
        checked.images[0].components !== 4 ||
        checked.ppi !== 300 ||
        width !== 1254 ||
        height !== 1254
      )
        throw Error('Unverified pair: ' + id);
      const source = join(stage, 'extracted', folder);
      const repaired = extraction.repairs?.some((repair) => repair.id === id);
      const item = {
        id,
        ...packageMetadata(topic, id, checked.hashes.webp),
        discovery: packageDiscovery(id),
        topic,
        color: await colorOf(join(source, 'webp', id + '.webp'), id),
        orientation: width === height ? 'Square' : width > height ? 'Landscape' : 'Portrait',
        width,
        height,
        sourceType: 'raster',
        svg: null,
        sourceCollection: collection,
        provenance: repaired
          ? 'Owner-supplied PDF; WebP reconstructed from the matching PDF after a source pairing defect was found.'
          : 'Owner-supplied collection; original PDF and WebP bytes preserved.',
        productionMethod: 'owner-supplied',
        licenseStatus: 'OWNER_APPROVED_PERSONAL_EDUCATIONAL_ONLY',
        license:
          'Free personal and educational use. Commercial use and resale as clipart are prohibited.',
        licenseApprovedAt: '2026-10-25',
        reviewStatus: 'FORMAT_AND_PAIR_REVIEW_PASSED',
        published: true,
        indexable: true,
        createdAt: extraction.extractedAt,
        revision: 1,
        formats: ['WEBP', 'PDF'],
        printProfile: checked.images[0].profile,
        pdfColorSpace: checked.images[0].colorSpace,
        pdfPage: checked.pagePoints.map((n) => (n / 72).toFixed(3)).join(' × ') + ' in',
        alpha: true,
        files: {},
      };
      for (const kind of ['webp', 'pdf']) {
        const path = join(source, kind, id + '.' + kind),
          body = readFileSync(path);
        if (hash(body) !== checked.hashes[kind] || body.length !== checked[kind + 'Bytes'])
          throw Error('Source changed: ' + id);
        const destination = join(target, id + '.' + kind);
        if (existsSync(destination) && hash(readFileSync(destination)) !== checked.hashes[kind])
          throw Error('Conflicting destination: ' + id);
        copyFileSync(path, destination);
      }
      const thumb = join(target, id + '-thumb.webp');
      if (!existsSync(thumb))
        await sharp(join(target, id + '.webp'))
          .resize(440, 440, { fit: 'inside', withoutEnlargement: true })
          .toColourspace('srgb')
          .webp({ quality: 94, alphaQuality: 100, effort: 6 })
          .toFile(thumb);
      const meta = await sharp(thumb).metadata(),
        scale = Math.min(1, 440 / Math.max(width, height));
      if (
        !meta.hasAlpha ||
        Math.abs(meta.width - width * scale) > 1 ||
        Math.abs(meta.height - height * scale) > 1
      )
        throw Error('Invalid thumbnail: ' + id);
      for (const kind of ['webp', 'pdf', 'thumb']) {
        const name = id + (kind === 'thumb' ? '-thumb.webp' : '.' + kind),
          body = readFileSync(join(target, name)),
          sha256 = hash(body),
          representation = kind === 'thumb' ? 'thumbnail' : kind;
        item[kind] = `/catalog/${topic}/${name}`;
        item.files[kind] = { bytes: body.length, sha256 };
        batch.push({
          assetId: id,
          sourceType: 'raster',
          kind: representation,
          bucket: 'ultraclipart-media',
          jurisdiction: 'default',
          key: `${topic}/${id}.${representation}.${sha256.slice(0, 16)}.${kind === 'pdf' ? 'pdf' : 'webp'}`,
          path: `public/catalog/${topic}/${name}`,
          bytes: body.length,
          sha256,
        });
      }
      items.push(item);
      proof.push({
        id,
        topic,
        hashes: checked.hashes,
        pdfBytes: checked.pdfBytes,
        width,
        height,
        pdfAlphaExact: true,
        components: 4,
        ppi: checked.ppi,
        pairedWebp: checked.pairedWebp,
        meanRgbDifference: checked.meanRgbDifference,
      });
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  items.sort((a, b) => a.id.localeCompare(b.id));
  batch.sort((a, b) => a.assetId.localeCompare(b.assetId) || a.kind.localeCompare(b.kind));
  validateBatch(batch);
  if (
    new Set(items.map((x) => x.alt)).size !== 50 ||
    new Set(items.map((x) => x.title)).size !== 50
  )
    throw Error('Duplicate metadata in ' + topic);
  imported.push(...items);
  copy[topic] = packageCollectionCopy(topic, items);
  if (!topics.some((x) => x.slug === topic)) {
    const row = {
      id: nextTopicId++,
      keyword: packageContexts[topic].label + ' clipart',
      slug: topic,
      cluster: packageContexts[topic].cluster,
      wave: 'OWNER_COLLECTION',
      target_original_artworks: 50,
      focus_note: packageContexts[topic].intro,
      supplemental: true,
    };
    extra.push(row);
    topics.push(row);
  } else if (topics.find((x) => x.slug === topic).cluster !== packageContexts[topic].cluster)
    throw Error('Unexpected existing category: ' + topic);
  secondary[topic] = [
    ...new Set([...(secondary[topic] ?? []), ...(packageContexts[topic].secondary ?? [])]),
  ];
  save(join(stage, topic + '.r2-batch.json'), batch);
  save(join(stage, topic + '.catalog.next.json'), [...originalArt, ...imported]);
  console.log(
    JSON.stringify({
      topic,
      artworks: items.length,
      bytes: batch.reduce((s, x) => s + x.bytes, 0),
      status: 'PREPARED_NOT_PUBLISHED',
    }),
  );
}
const review = read(join(stage, 'screen-review.json'));
if (review.sheets.length !== 62) throw Error('All 62 visual review sheets required');
const duplicateReport = read(join(stage, 'duplicate-review.json'));
if (
  duplicateReport.status !== 'PASS' ||
  duplicateReport.new !== 1550 ||
  duplicateReport.collisions.length ||
  duplicateReport.baseline !== originalArt.length ||
  duplicateReport.baselineCatalogSha256 !== hash(readFileSync(join(root, 'data/art.json')))
)
  throw Error(
    'Original-byte and decoded-pixel duplicate review is required against the current catalog',
  );
const all = [...originalArt, ...imported];
if (
  JSON.stringify(
    imported
      .filter((x) => x.discovery.cute)
      .map((x) => x.id)
      .sort(),
  ) !== JSON.stringify([...discoveryReview.cuteSelections].sort())
)
  throw Error('Cute discovery selections differ from the reviewed artwork');
if (new Set(topics.map((x) => x.id)).size !== topics.length)
  throw Error('Category IDs collide with another release');
if (imported.length !== 1550 || new Set(all.map((x) => x.id)).size !== all.length)
  throw Error('Expansion count/identity mismatch');
const colorReview = read(join(stage, 'color-review.json'));
if (
  colorReview.status !== 'PASS' ||
  !colorReview.reviewedFromActualPixels ||
  colorReview.rows?.length !== imported.length ||
  colorReview.sheet !== 'review/color-audit.png' ||
  hash(readFileSync(join(stage, colorReview.sheet))) !== colorReview.sheetSha256 ||
  colorReview.review?.length !== 16
)
  throw Error('The pixel-color audit needs complete visual review');
for (const row of colorReview.review)
  if (imported.find((item) => item.id === row.id)?.style !== row.reviewedStyle)
    throw Error('Published style differs from the pixel-color review: ' + row.id);
const coverReview = read(join(stage, 'cover-review.json'));
if (
  coverReview.status !== 'PASS' ||
  !coverReview.reviewedFromActualPixels ||
  coverReview.sheet !== 'review/collection-covers.png' ||
  hash(readFileSync(join(stage, coverReview.sheet))) !== coverReview.sheetSha256 ||
  coverReview.rows?.length !== mapping.length
)
  throw Error('The collection covers need complete visual review');
for (const { topic } of mapping) {
  const cover = imported.find((item) => item.id === packageContexts[topic].cover);
  const rows = coverReview.rows.filter((row) => row.topic === topic);
  if (rows.length !== 1 || rows[0].id !== cover?.id || rows[0].sha256 !== cover?.files.webp.sha256)
    throw Error('The reviewed collection cover differs: ' + topic);
}
save(join(stage, 'art.next.json'), all);
save(join(stage, 'extra-topics.next.json'), extra);
save(join(stage, 'topics.next.json'), baseTopics);
save(join(stage, 'topic-clusters.next.json'), secondary);
save(join(stage, 'collection-copy.next.json'), copy);
save(join(stage, 'review.next.json'), {
  collection,
  count: 1550,
  archives: extraction.archives,
  ownerArchives: extraction.ownerArchives,
  screenReview: 'PASS',
  reviewerType: 'AI_AGENT_NOT_HUMAN',
  physicalPrintProof: false,
  screenReviewSheets: review.sheets,
  screenReviewObservations: review.observations,
  productIdentityReview: {
    status: 'PASS',
    reviewedFromActualPixels: true,
    records: imported.filter((item) => item.productIdentity).length,
    registrySha256: hash(readFileSync(join(root, 'scripts/remaining-product-identities.json'))),
    sourceBound: true,
  },
  duplicateReview: {
    status: duplicateReport.status,
    algorithm: duplicateReport.algorithm,
    baseline: duplicateReport.baseline,
    baselineCatalogSha256: duplicateReport.baselineCatalogSha256,
    new: duplicateReport.new,
    collisions: duplicateReport.collisions,
    reportSha256: hash(readFileSync(join(stage, 'duplicate-review.json'))),
  },
  discoveryReview,
  coverReview,
  colorReview: {
    status: colorReview.status,
    algorithm: colorReview.algorithm,
    checked: colorReview.rows.length,
    sheet: colorReview.sheet,
    sheetSha256: colorReview.sheetSha256,
    reviewedFromActualPixels: true,
    candidates: colorReview.review,
  },
  rows: proof,
});
console.log(
  JSON.stringify({ status: 'EXPANSION_PREPARED', artworks: imported.length, total: all.length }),
);
