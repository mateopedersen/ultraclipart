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
import { validateBatch } from './r2/plan.mjs';
import { fireLeafCollectionCopy, fireLeafMetadata } from './fire-leaf-copy.mjs';

const root = resolve(import.meta.dirname, '..');
const stage = join(root, 'work/imports/fire-leaf');
const priorStage = join(root, 'work/imports/fruit-five-packs');
const collection = 'owner-fire-leaf-two-packs-2026-10-24';
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const hash = (body) => createHash('sha256').update(body).digest('hex');
const save = (p, value) => {
  const tmp = p + '.tmp';
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  renameSync(tmp, p);
};
const mapping = read(join(stage, 'topic-map.json'));
if (
  mapping.length !== 2 ||
  mapping.some((m) => m.folder !== m.topic + '-clipart' || m.pairs !== 50) ||
  [...mapping.map((m) => m.topic)].sort().join() !== Object.keys({ fire: 1, leaf: 1 }).sort().join()
)
  throw Error('Unexpected package mapping');
const review = read(join(stage, 'screen-review.json'));
const extraction = read(join(stage, 'extraction.json'));
const originalArt = read(join(priorStage, 'art.next.json'));
if (originalArt.some((x) => x.sourceCollection === collection))
  throw Error('This expansion is already published; preserve its history');
const extra = read(join(priorStage, 'extra-topics.next.json'));
const topics = [...read(join(root, 'data/topics.json')).topics, ...extra];
const copy = read(join(priorStage, 'collection-copy.next.json'));
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
  const catalogTopic = topic === 'leaf' ? 'leaves' : topic;
  const preflight = read(join(stage, 'review', topic, 'preflight.json'));
  if (
    preflight.status !== 'FORMAT_PASSED' ||
    !preflight.allPairsVisuallyMatched ||
    preflight.rows.length !== 50 ||
    review.topics[topic] !== 'PASS'
  )
    throw Error('Technical and visual review required: ' + topic);
  const target = join(root, 'public/catalog', catalogTopic);
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
        checked.ppi !== 300
      )
        throw Error('Unverified pair: ' + id);
      const source = join(stage, 'extracted', folder);
      const item = {
        id,
        ...fireLeafMetadata(topic, id),
        topic: catalogTopic,
        color: await colorOf(join(source, 'webp', id + '.webp'), id),
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
        licenseApprovedAt: '2026-10-24',
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
        item[kind] = `/catalog/${catalogTopic}/${name}`;
        item.files[kind] = { bytes: body.length, sha256 };
        batch.push({
          assetId: id,
          sourceType: 'raster',
          kind: representation,
          bucket: 'ultraclipart-media',
          jurisdiction: 'default',
          key: `${catalogTopic}/${id}.${representation}.${sha256.slice(0, 16)}.${kind === 'pdf' ? 'pdf' : 'webp'}`,
          path: `public/catalog/${catalogTopic}/${name}`,
          bytes: body.length,
          sha256,
        });
      }
      items.push(item);
      proof.push({
        id,
        topic: catalogTopic,
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
  for (const representation of batch) {
    const path = join(root, representation.path);
    if (!existsSync(path) || hash(readFileSync(path)) !== representation.sha256)
      throw Error('Missing or changed upload source: ' + representation.assetId);
  }
  if (
    new Set(items.map((x) => x.alt)).size !== 50 ||
    new Set(items.map((x) => x.title)).size !== 50
  )
    throw Error('Duplicate metadata in ' + topic);
  imported.push(...items);
  copy[catalogTopic] = fireLeafCollectionCopy(catalogTopic, items);
  if (topic === 'fire') {
    if (topics.some((x) => x.slug === 'fire')) throw Error('Fire category already exists');
    const row = {
      id: 334,
      keyword: 'Fire clipart',
      slug: 'fire',
      cluster: 'Nature & elements',
      wave: 'OWNER_COLLECTION',
      target_original_artworks: 50,
      focus_note:
        'Flames, candles, campfires and lamps; distinct from the fireplace and fireworks collections.',
      supplemental: true,
    };
    extra.push(row);
    topics.push(row);
  } else if (topics.find((x) => x.slug === catalogTopic)?.cluster !== 'Thanksgiving & Autumn') {
    throw Error('Existing Leaves category has changed');
  }
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
const all = [...originalArt, ...imported];
if (new Set(topics.map((x) => x.id)).size !== topics.length)
  throw Error('Category IDs collide with another release');
if (imported.length !== 100 || new Set(all.map((x) => x.id)).size !== all.length)
  throw Error('Expansion count/identity mismatch');
save(join(stage, 'art.next.json'), all);
save(join(stage, 'extra-topics.next.json'), extra);
save(join(stage, 'collection-copy.next.json'), copy);
save(join(stage, 'review.next.json'), {
  collection,
  count: 100,
  archives: extraction.archives,
  screenReview: 'PASS',
  reviewerType: 'AI_AGENT_NOT_HUMAN',
  physicalPrintProof: false,
  rows: proof,
});
console.log(
  JSON.stringify({ status: 'EXPANSION_PREPARED', artworks: imported.length, total: all.length }),
);
