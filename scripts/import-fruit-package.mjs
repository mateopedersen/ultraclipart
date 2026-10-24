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
import { collectionCopy } from './fruit-collection-copy.mjs';
import { visibleSubject } from './supplied-metadata.mjs';

const root = resolve(import.meta.dirname, '..');
const stage = join(root, 'work/imports/fruit-package');
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, value) => {
  const temporary = path + `.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
  renameSync(temporary, path);
};
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const initialHeld = new Set(read(join(stage, 'repair-hold.json')).items.map((item) => item.id));
const resolution = existsSync(join(stage, 'resolved-repairs.json'))
  ? read(join(stage, 'resolved-repairs.json'))
  : { acceptedIds: [] };
if (
  resolution.acceptedIds.some((id) => !initialHeld.has(id)) ||
  (resolution.acceptedIds.length && resolution.screenReview !== 'PASS')
)
  throw new Error('Repair resolution requires matching source and visual approval');
const held = new Set([...initialHeld].filter((id) => !resolution.acceptedIds.includes(id)));
const intakeTimestamp = read(join(stage, 'extraction.json')).extractedAt;
if (typeof intakeTimestamp !== 'string' || !Number.isFinite(Date.parse(intakeTimestamp)))
  throw new Error('A recorded intake timestamp is required');
const reviews = read(join(stage, 'screen-review.json'));
const mapping = read(join(stage, 'topic-map.json'));
if (
  mapping.length !== 11 ||
  new Set(mapping.map((row) => row.topic)).size !== 11 ||
  mapping.some(
    ({ topic, folder, sourceTopic = topic }) =>
      !/^[a-z][a-z0-9-]*$/.test(topic) ||
      !/^[a-z][a-z0-9-]*$/.test(sourceTopic) ||
      folder !== sourceTopic + '-clipart' ||
      (sourceTopic === 'kiwi' ? topic !== 'kiwi-fruit' : topic !== sourceTopic),
  )
)
  throw new Error('Unexpected or unsafe fruit topic mapping');
const existing = read(join(root, 'data/art.json'));
if (existing.some((item) => item.replacesArtwork?.sourceCollection === 'owner-fruit-2026-10-24'))
  throw new Error(
    'This intake has reviewed replacements; a refresh must explicitly preserve their revision history',
  );
if (
  existing.some((item) => item.sourceCollection === 'owner-fruit-2026-10-24') &&
  !process.argv.includes('--refresh-prepared-intake')
)
  throw new Error('Existing intake: use --refresh-prepared-intake to rebuild its staged records');
const base = existing.filter((item) => item.sourceCollection !== 'owner-fruit-2026-10-24');
const extra = read(join(root, 'data/extra-topics.json'));
const copy = read(join(root, 'data/collection-copy.json'));
const original = new Set(read(join(root, 'data/topics.json')).topics.map((item) => item.slug));
const imported = [],
  proof = [];
const targetRoot = join(root, 'public/catalog');
const titleOf = (id) =>
  id
    .replace(/-clipart$/, '')
    .replace(/-black-and-white/g, ' (black and white)')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
async function colorOf(path, id) {
  if (/black-and-white|silhouette|linocut|charcoal|dotwork|stipple/.test(id)) return 'Black';
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
    let color;
    if (max - min < 22) color = max > 218 ? 'White' : max < 65 ? 'Black' : 'Gray';
    else if (r > b * 1.2 && g > b * 1.18)
      color =
        r > g * 1.7 ? 'Red' : g > r * 0.88 ? 'Yellow' : max < 200 || min > 45 ? 'Brown' : 'Orange';
    else if (r > g * 1.3 && b > g * 1.2) color = r > b * 1.15 ? 'Pink' : 'Purple';
    else color = g > r && g > b ? 'Green' : b > r ? 'Blue' : 'Red';
    counts[color] = (counts[color] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Gray';
}
for (const { topic, folder, sourceTopic = topic } of mapping) {
  const preflight = read(join(stage, 'review', sourceTopic, 'preflight.json'));
  if (
    preflight.status !== 'FORMAT_PASSED' ||
    !preflight.allPairsVisuallyMatched ||
    reviews.topics[topic] !== 'PASS'
  )
    throw new Error(`Independent technical and screen reviews required: ${topic}`);
  const expectedCount = 50 - preflight.heldIds.length;
  if (preflight.rows.length !== expectedCount) throw new Error('Unexpected approved count');
  const target = join(targetRoot, topic);
  mkdirSync(target, { recursive: true });
  const items = [],
    batch = [];
  let cursor = 0;
  async function worker() {
    while (cursor < preflight.rows.length) {
      const checked = preflight.rows[cursor++];
      const { id, width, height } = checked;
      if (
        !/^[a-z0-9-]+$/.test(id) ||
        held.has(id) ||
        checked.pairedWebp !== id ||
        !checked.pdfAlphaExact ||
        checked.images[0].components !== 4
      )
        throw new Error(`Blocked or unverified artwork: ${id}`);
      const title =
          topic === 'kiwi-fruit'
            ? titleOf(id)
                .replace(/^Kiwi (?:Fruit )?/, 'Kiwifruit ')
                .replace('Fresh Fruit', 'Fresh')
            : titleOf(id),
        subject = visibleSubject(checked.metadata['/Subject']);
      const sourceRoot = checked.sourceRoot
        ? resolve(root, checked.sourceRoot)
        : join(stage, 'extracted');
      if (!sourceRoot.startsWith(join(root, 'work/imports') + '/'))
        throw new Error('Source overlay must stay inside the reviewed import workspace');
      const style = /outline|line-art|coloring|geometric-line/.test(id)
        ? 'Outline'
        : /black-and-white|silhouette|linocut|charcoal|stipple|dotwork/.test(id)
          ? 'Black & White'
          : /watercolor/.test(id)
            ? 'Watercolor'
            : 'Color';
      const alt = `${title.replace(/ Clipart$/, '')}. ${subject}`;
      if (alt.length > 420 || /described below|CMYK|pixels per inch|no words|no digits/i.test(alt))
        throw new Error(`Unsuitable public alt: ${id}`);
      const use = /outline|coloring/.test(id)
        ? 'Leave the open areas clear for a classroom coloring activity.'
        : /cartoon|kawaii/.test(id)
          ? 'Use this character beside a caption on a personal card or classroom story prompt.'
          : /wreath|floral|garland/.test(id)
            ? 'Leave room for a heading when arranging a personal invitation or recipe page.'
            : 'Arrange it on a personal recipe page, fruit vocabulary card or classroom sorting activity.';
      const item = {
        id,
        title,
        alt,
        description: `${subject} ${use}`,
        topic,
        color: await colorOf(join(sourceRoot, folder, 'webp', id + '.webp'), id),
        style,
        orientation: width === height ? 'Square' : width > height ? 'Landscape' : 'Portrait',
        width,
        height,
        sourceType: 'raster',
        svg: null,
        sourceCollection: 'owner-fruit-2026-10-24',
        provenance: 'Owner-supplied collection; original PDF and WebP bytes preserved.',
        productionMethod: 'owner-supplied',
        licenseStatus: 'OWNER_APPROVED_PERSONAL_EDUCATIONAL_ONLY',
        license:
          'Free personal and educational use. Commercial use and resale as clipart are prohibited.',
        licenseApprovedAt: '2026-10-24',
        reviewStatus: 'FORMAT_AND_PAIR_REVIEW_PASSED',
        published: true,
        indexable: true,
        createdAt: intakeTimestamp,
        revision: 1,
        formats: ['WEBP', 'PDF'],
        printProfile: checked.images[0].profile,
        pdfColorSpace: checked.images[0].colorSpace,
        pdfPage: checked.pagePoints.map((n) => (n / 72).toFixed(3)).join(' × ') + ' in',
        alpha: true,
        files: {},
      };
      for (const kind of ['pdf', 'webp']) {
        const source = join(sourceRoot, folder, kind, id + '.' + kind),
          bytes = readFileSync(source);
        if (sha(bytes) !== checked.hashes[kind] || bytes.length !== checked[kind + 'Bytes'])
          throw new Error(`Changed source: ${id}`);
        const destination = join(target, id + '.' + kind);
        if (existsSync(destination) && sha(readFileSync(destination)) !== checked.hashes[kind])
          throw new Error('Preserve edited destination');
        copyFileSync(source, destination);
      }
      const thumb = join(target, id + '-thumb.webp');
      if (!existsSync(thumb))
        await sharp(join(target, id + '.webp'))
          .resize(440, 440, { fit: 'inside', withoutEnlargement: true })
          .toColourspace('srgb')
          .webp({ quality: 94, alphaQuality: 100, effort: 6 })
          .toFile(thumb);
      const preview = await sharp(thumb).metadata();
      const previewScale = Math.min(1, 440 / Math.max(width, height));
      if (
        Math.abs(preview.width - width * previewScale) > 1 ||
        Math.abs(preview.height - height * previewScale) > 1 ||
        !preview.hasAlpha
      )
        throw new Error(`Invalid derived preview: ${id}`);
      for (const kind of ['pdf', 'webp', 'thumb']) {
        const name = id + (kind === 'thumb' ? '-thumb.webp' : '.' + kind),
          bytes = readFileSync(join(target, name)),
          sha256 = sha(bytes);
        item[kind] = `/catalog/${topic}/${name}`;
        item.files[kind] = { bytes: bytes.length, sha256 };
        const representation = kind === 'thumb' ? 'thumbnail' : kind;
        batch.push({
          assetId: id,
          sourceType: 'raster',
          kind: representation,
          bucket: 'ultraclipart-media',
          jurisdiction: 'default',
          key: `${topic}/${id}.${representation}.${sha256.slice(0, 16)}.${kind === 'pdf' ? 'pdf' : 'webp'}`,
          path: `public/catalog/${topic}/${name}`,
          bytes: bytes.length,
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
  if (new Set(items.map((item) => item.alt)).size !== items.length)
    throw new Error('Duplicate descriptions');
  validateBatch(batch);
  imported.push(...items);
  copy[topic] = collectionCopy(topic, items);
  if (!original.has(topic) && !extra.some((item) => item.slug === topic))
    extra.push({
      id: Math.max(...extra.map((entry) => entry.id), 110) + 1,
      keyword: topic.replaceAll('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) + ' clipart',
      slug: topic,
      cluster: 'Food & drink',
      wave: 'OWNER_COLLECTION',
      target_original_artworks: 50,
      focus_note: '',
      supplemental: true,
    });
  save(join(stage, topic + '.r2-batch.json'), batch);
  save(join(stage, topic + '.catalog.next.json'), [...base, ...imported]);
  console.log(
    JSON.stringify({
      topic,
      imported: items.length,
      files: batch.length,
      bytes: batch.reduce((n, item) => n + item.bytes, 0),
    }),
  );
}
const all = [...base, ...imported];
if (
  imported.length !== 550 - held.size ||
  new Set(all.map((item) => item.id)).size !== all.length ||
  all.some((item) => held.has(item.id))
)
  throw new Error('Final catalog count/hold violation');
save(join(stage, 'art.next.json'), all);
save(join(stage, 'extra-topics.next.json'), extra);
save(join(stage, 'collection-copy.next.json'), copy);
save(join(stage, 'review.next.json'), {
  collection: 'owner-fruit-2026-10-24',
  count: imported.length,
  screenReview: 'PASS',
  reviewerType: 'AI_AGENT_NOT_HUMAN',
  physicalPrintProof: false,
  heldIds: [...held],
  repairedIds: resolution.acceptedIds,
  rows: proof,
});
console.log(
  JSON.stringify({
    status: 'INTAKE_PREPARED_NOT_PUBLISHED',
    newArtwork: imported.length,
    totalArtwork: all.length,
  }),
);
