import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { validateBatch } from './r2/plan.mjs';
import { reviewedProductMetadata } from './product-identity.mjs';
import { metadataSignature, validateEditorialReview } from './artwork-editorial.mjs';
import { applyEditorialBatch } from './apply-editorial-review.mjs';
import { collectionSourceSignature, validateCollectionCopy } from './collection-editorial.mjs';

const root = path.resolve(import.meta.dirname, '..');
const stage = path.join(root, 'work/imports/tesla-commerce-550');
export const collection = 'owner-tesla-commerce-550-2026-10-27';
const read = (p) => JSON.parse(fs.readFileSync(p));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const save = (p, value) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p + '.tmp', JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(p + '.tmp', p);
};
const baselineBytes = fs.readFileSync(path.join(root, 'data/art.json'));
const baseline = JSON.parse(baselineBytes);
assert(!baseline.some((x) => x.sourceCollection === collection), 'Batch already promoted');
const mapping = read(path.join(stage, 'topic-map.json'));
const extraction = read(path.join(stage, 'extraction.json'));
const exact = read(path.join(stage, 'duplicate-review.json'));
const perceptual = read(path.join(stage, 'perceptual-review.json'));
const delta = read(path.join(stage, 'concurrent-delta-review.json'));
assert.equal(exact.status, 'PASS');
assert.equal(exact.baselineCatalogSha256, sha(baselineBytes), 'Reconcile current catalog first');
assert.equal(perceptual.status, 'PASS');
assert.equal(perceptual.decisions.length, perceptual.candidates.length);
assert.equal(delta.status, 'PASS');
assert.equal(delta.decisions.length, delta.candidates.length);
for (const decision of delta.decisions) {
  assert.equal(decision.status, 'DISTINCT_COMPOSITION');
  assert(decision.reviewedFromActualPairSheet && decision.observedDifference);
  assert.deepEqual(decision.sourceSha256s, delta.candidates[decision.index].sourceSha256s);
}
assert.equal(delta.unchangedAcceptedSources + delta.baselineAdded, baseline.length);
const contexts = read(path.join(root, 'scripts/tesla-commerce-context.json'));
const extra = read(path.join(root, 'data/extra-topics.json'));
const baseTopics = read(path.join(root, 'data/topics.json')).topics;
const copy = read(path.join(root, 'data/collection-copy.json'));
const clusters = read(path.join(root, 'data/topic-clusters.json'));
const dependencies = sha(
  Buffer.concat(
    ['scripts/verify-supplied-pairs.py', 'scripts/raster_source.py'].map((p) =>
      fs.readFileSync(path.join(root, p)),
    ),
  ),
);
const checkedAt = new Date().toISOString();
const official = 'https://www.tesla.com/support/robotaxi/cybercab';
const filing = 'https://ir.tesla.com/_flysystem/s3/sec/000162828024043432/tsla-20241023-gen.pdf';
const robotics = 'https://www.tesla.com/AI';
const items = [],
  reviews = [],
  identities = [],
  objects = [],
  proofs = [],
  sheetReview = {};
const observationRows = [];
const sourceSeen = new Set();
// Thumbnails are the only derived assets. Prepare missing ones with bounded
// local workers and atomic rename; original downloads are never re-encoded.
const thumbnailJobs = [];
for (const map of mapping) {
  const rows = fs
    .readFileSync(path.join(stage, 'review', map.topic + '.tsv'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => line.split('|'));
  for (const [index, id] of map.ids.entries()) {
    const topic =
      map.topic === 'tesla-cybercab'
        ? 'cybercab'
        : map.topic === 'optimus-robot'
          ? rows[index][3] === 'G'
            ? 'robot'
            : 'tesla-optimus'
          : map.topic;
    const thumb = path.join(root, 'public/catalog', topic, id + '-thumb.webp');
    if (!fs.existsSync(thumb))
      thumbnailJobs.push({
        source: path.join(stage, 'extracted', map.folder, 'webp', id + '.webp'),
        thumb,
      });
  }
}
let thumbnailCursor = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (thumbnailCursor < thumbnailJobs.length) {
      const { source, thumb } = thumbnailJobs[thumbnailCursor++];
      fs.mkdirSync(path.dirname(thumb), { recursive: true });
      const temporary = thumb + '.tmp';
      await sharp(source)
        .resize(440, 440, { fit: 'inside', withoutEnlargement: true })
        .toColourspace('srgb')
        .webp({ quality: 94, alphaQuality: 100, effort: 6 })
        .toFile(temporary);
      fs.renameSync(temporary, thumb);
    }
  }),
);
console.log(JSON.stringify({ preparedThumbnails: thumbnailJobs.length }));
for (const map of mapping) {
  const rows = fs
    .readFileSync(path.join(stage, 'review', map.topic + '.tsv'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => line.split('|'));
  assert.equal(rows.length, 50);
  const preflight = read(path.join(stage, 'review', map.topic, 'preflight.json'));
  assert.equal(preflight.status, 'FORMAT_PASSED');
  assert(preflight.allPairsVisuallyMatched);
  assert.equal(preflight.rows.length, 50);
  sheetReview[map.topic] = { status: 'PASS', sheets: [], pdfSheets: [] };
  for (const [key, name] of [
    ['sheets', 'contact/' + map.topic + '-'],
    ['pdfSheets', 'review/' + map.topic + '/pdf-contact-'],
  ]) {
    for (const number of [1, 2]) {
      const p = name + number + (key === 'sheets' ? '.jpg' : '.png');
      sheetReview[map.topic][key].push({
        path: p,
        sha256: sha(fs.readFileSync(path.join(stage, p))),
        reviewedFromPixels: true,
      });
    }
  }
  for (const [index, id] of map.ids.entries()) {
    const [title, alt, detail, identityKind] = rows[index];
    assert(rows[index].length === 4 && ['P', 'C', 'O', 'G'].includes(identityKind));
    assert(!sourceSeen.has(id));
    sourceSeen.add(id);
    const proof = preflight.rows.find((x) => x.id === id);
    assert(
      proof &&
        proof.dependencies === dependencies &&
        proof.pairedWebp === id &&
        proof.pdfAlphaExactToPrintSource,
    );
    const topic =
      map.topic === 'tesla-cybercab'
        ? 'cybercab'
        : map.topic === 'optimus-robot'
          ? identityKind === 'G'
            ? 'robot'
            : 'tesla-optimus'
          : map.topic;
    assert(
      identityKind !== 'G' ||
        !/\bTesla|\bOptimus|\bCybercab/i.test(title + ' ' + alt + ' ' + detail),
    );
    const target = path.join(root, 'public/catalog', topic);
    fs.mkdirSync(target, { recursive: true });
    const item = {
      id,
      title,
      alt,
      description: alt + ' ' + detail,
      topic,
      sourceType: 'raster',
      svg: null,
      sourceCollection: collection,
      sourceArchiveTopic: map.topic,
      provenance: 'Owner-supplied collection; original PDF and WebP bytes preserved.',
      productionMethod: 'owner-supplied',
      licenseStatus: 'OWNER_APPROVED_PERSONAL_EDUCATIONAL_ONLY',
      license:
        'Free personal and educational use. Commercial use and resale as clipart are prohibited.',
      licenseApprovedAt: '2026-10-27',
      reviewStatus: 'FORMAT_AND_PAIR_REVIEW_PASSED',
      published: true,
      indexable: true,
      createdAt: extraction.extractedAt,
      revision: 1,
      formats: ['WEBP', 'PDF'],
      width: proof.width,
      height: proof.height,
      alpha: true,
      orientation:
        proof.width === proof.height
          ? 'Square'
          : proof.width > proof.height
            ? 'Landscape'
            : 'Portrait',
      printProfile: proof.images[0].profile,
      pdfColorSpace: proof.images[0].colorSpace,
      pdfPage: proof.pagePoints.map((x) => (x / 72).toFixed(3)).join(' × ') + ' in',
      pdfPrint: {
        width: proof.printDimensions[0],
        height: proof.printDimensions[1],
        ppi: proof.ppi,
        pagePoints: proof.pagePoints,
      },
      // The three inspected, rounded toy-like robots are suitable for Surprise me.
      // Recognizable industrial robots and technical/retail diagrams stay excluded.
      discovery: { cute: topic === 'robot' },
      files: {},
    };
    for (const kind of ['webp', 'pdf']) {
      const original = path.join(stage, 'extracted', map.folder, kind, id + '.' + kind);
      const body = fs.readFileSync(original);
      assert.equal(sha(body), proof.hashes[kind]);
      assert.equal(body.length, proof[kind + 'Bytes']);
      const archived = extraction.files.find(
        (x) => x.path === `${map.folder}/${kind}/${id}.${kind}`,
      );
      assert.equal(archived.sha256, sha(body));
      const dest = path.join(target, id + '.' + kind);
      if (fs.existsSync(dest)) assert.equal(sha(fs.readFileSync(dest)), sha(body));
      else fs.linkSync(original, dest);
    }
    const thumb = path.join(target, id + '-thumb.webp');
    if (!fs.existsSync(thumb))
      await sharp(path.join(target, id + '.webp'))
        .resize(440, 440, { fit: 'inside', withoutEnlargement: true })
        .toColourspace('srgb')
        .webp({ quality: 94, alphaQuality: 100, effort: 6 })
        .toFile(thumb);
    const { data } = await sharp(path.join(target, id + '.webp'))
      .resize(96, 96, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let visible = 0,
      chromatic = 0;
    const palette = {};
    for (let p = 0; p < data.length; p += 4) {
      if (data[p + 3] < 128) continue;
      const [r, g, b] = data.subarray(p, p + 3),
        hi = Math.max(r, g, b),
        lo = Math.min(r, g, b);
      visible++;
      if (hi - lo > 12) chromatic++;
      const color =
        hi - lo < 22
          ? hi > 225
            ? 'White'
            : hi < 65
              ? 'Black'
              : 'Gray'
          : r > g * 1.15 && r > b * 1.15
            ? g > 110
              ? 'Orange'
              : 'Red'
            : g > r * 1.1 && g > b * 1.1
              ? 'Green'
              : b > r * 1.1 && b > g * 1.1
                ? 'Blue'
                : r > 150 && g > 135 && b < 125
                  ? 'Yellow'
                  : b > 100 && r > 100
                    ? 'Purple'
                    : 'Brown';
      palette[color] = (palette[color] ?? 0) + 1;
    }
    item.style = chromatic / visible < 0.005 ? 'Black & White' : 'Color';
    item.visualStyle =
      item.style === 'Black & White' ? 'Black-and-white illustration' : 'Full-color illustration';
    item.color = Object.entries(palette).sort((a, b) => b[1] - a[1])[0][0];
    for (const kind of ['webp', 'pdf', 'thumb']) {
      const name = id + (kind === 'thumb' ? '-thumb.webp' : '.' + kind),
        body = fs.readFileSync(path.join(target, name)),
        h = sha(body);
      item[kind] = `/catalog/${topic}/${name}`;
      item.files[kind] = { bytes: body.length, sha256: h };
      const representation = kind === 'thumb' ? 'thumbnail' : kind;
      objects.push({
        assetId: id,
        sourceType: 'raster',
        kind: representation,
        bucket: 'ultraclipart-media',
        jurisdiction: 'default',
        key: `${topic}/${id}.${representation}.${h.slice(0, 16)}.${kind === 'pdf' ? 'pdf' : 'webp'}`,
        path: 'public' + item[kind],
        bytes: body.length,
        sha256: h,
      });
    }
    const references = [];
    if (identityKind !== 'G') {
      const optimus = identityKind === 'O';
      const record = {
        id,
        reviewedFromPixels: true,
        sourceSha256: item.files.webp.sha256,
        sourcePath: item.webp.slice(1),
        kind: optimus
          ? 'product-family'
          : identityKind === 'C'
            ? 'imagined-concept'
            : 'recognized-product',
        subject: title,
        caption: item.description,
        evidence: alt + ' ' + detail,
        brand: 'Tesla',
        family: optimus ? 'Optimus' : 'Cybercab',
        model: identityKind === 'P' ? 'Cybercab' : null,
        reference: optimus ? robotics : official,
        manufacturerDomains: ['tesla.com'],
        checkedAt,
      };
      item.productIdentity = reviewedProductMetadata(record, {
        sourceSha256: item.files.webp.sha256,
      }).productIdentity;
      identities.push(record);
      references.push({
        publisher: 'Tesla',
        reason: optimus
          ? 'Compare the black face visor, pale body panels and articulated humanoid form; no generation or demonstrated capability inferred.'
          : 'Compare the low gold body, continuous light bars, dark glass roof, disc wheels and upward-opening doors; alternative configurations remain concepts.',
        url: record.reference,
      });
      references.push({
        publisher: 'Tesla Investor Relations',
        reason: optimus
          ? 'Official photographs on printed pages 18–19; family-level visual comparison.'
          : 'Official Cybercab photograph on printed page 15; visual form comparison.',
        url: filing,
      });
    }
    const review = {
      id,
      status: 'reviewed-from-image',
      sourceSha256: item.files.webp.sha256,
      imageSha256: item.files.webp.sha256,
      inputMetadataSha256: metadataSignature(item),
      inspectedImage: item.webp,
      reviewedAt: checkedAt,
      observations: [alt, detail],
      references,
      copy: { title, alt, description: item.description },
    };
    validateEditorialReview(item, review);
    reviews.push(review);
    items.push(item);
    proofs.push(proof);
    observationRows.push({
      id,
      archiveTopic: map.topic,
      sourceSha256: item.files.webp.sha256,
      sourceSheet: Math.floor(index / 25) + 1,
      sourcePosition: (index % 25) + 1,
      observations: [alt, detail],
    });
  }
}
assert.equal(items.length, 550);
assert.equal(new Set(items.map((x) => x.title)).size, 550);
assert.equal(new Set(items.map((x) => x.alt)).size, 550);
assert.equal(objects.length, 1650);
let nextId = Math.max(...baseTopics.map((x) => x.id), ...extra.map((x) => x.id)) + 1;
const collectionReviews = { schema: 1, topics: {} };
for (const [topic, context] of Object.entries(contexts)) {
  const group = items.filter((x) => x.topic === topic);
  assert(group.length >= 50);
  assert(![...baseTopics, ...extra].some((x) => x.slug === topic));
  extra.push({
    id: nextId++,
    keyword: context.label + ' clipart',
    slug: topic,
    cluster: context.cluster,
    wave: 'OWNER_COLLECTION',
    target_original_artworks: group.length,
    focus_note: context.intro,
    supplemental: true,
  });
  copy[topic] = {
    description: context.description,
    lead: context.intro,
    intro: context.intro,
    featured: group
      .filter((x) => x.style === 'Color')
      .slice(0, 5)
      .map((x) => x.id),
    chips: [],
    heading: context.label + ' illustrations',
    paragraphs: [],
    print: '',
    related: context.related,
  };
  clusters[topic] = context.secondary;
  const record = {
    status: 'checked-against-catalog',
    sourceSha256: collectionSourceSignature(group),
    intro: context.intro,
    checkedAt,
    evidence: group
      .filter((x) => x.style === 'Color')
      .slice(0, 3)
      .map((x) => ({ id: x.id, imageSha256: x.files.webp.sha256 })),
  };
  validateCollectionCopy(topic, group, record);
  collectionReviews.topics[topic] = record;
}
// Robot is an existing base subject, so preserve its accepted copy and record only its new artwork.
const robotTopic = extra.find((x) => x.slug === 'robot');
if (robotTopic)
  robotTopic.target_original_artworks =
    baseline.filter((x) => x.topic === 'robot').length +
    items.filter((x) => x.topic === 'robot').length;
else if (baseTopics.some((x) => x.slug === 'robot'))
  extra.push({
    ...baseTopics.find((x) => x.slug === 'robot'),
    id: nextId++,
    target_original_artworks: baseline.filter((x) => x.topic === 'robot').length + 3,
    supplemental: true,
  });
save(path.join(stage, 'art.next.json'), [...baseline, ...items]);
save(path.join(stage, 'extra-topics.next.json'), extra);
save(path.join(stage, 'collection-copy.next.json'), copy);
save(path.join(stage, 'topic-clusters.next.json'), clusters);
save(path.join(stage, 'editorial-batch.json'), { schema: 1, artworks: reviews });
const reviewRoot = path.join(stage, 'editorial-root');
save(path.join(reviewRoot, 'data/art.json'), [...baseline, ...items]);
const priorReviews = read(path.join(root, 'data/editorial/reviews.json'));
save(path.join(reviewRoot, 'data/editorial/reviews.json'), {
  ...priorReviews,
  artworks: Array.isArray(priorReviews.artworks)
    ? priorReviews.artworks
    : Object.values(priorReviews.artworks),
});
console.log(applyEditorialBatch(reviewRoot, path.join(stage, 'editorial-batch.json')));
console.log(
  applyEditorialBatch(reviewRoot, path.join(stage, 'editorial-batch.json'), { write: true }),
);
save(path.join(stage, 'collection-editorial.next.json'), collectionReviews);
save(path.join(root, 'data/identification/tesla-commerce-550.json'), {
  schema: 1,
  collection,
  checkedAt,
  references: [
    { url: official },
    { url: robotics },
    {
      url: filing,
      sha256: sha(fs.readFileSync(path.join(stage, 'references/tesla-q3-2024-official.pdf'))),
    },
  ],
  artworks: identities,
});
save(path.join(stage, 'source-visual-review.json'), {
  status: 'PASS',
  reviewerType: 'AI_AGENT_NOT_HUMAN',
  physicalPrintProof: false,
  reviewedAt: checkedAt,
  topics: sheetReview,
  observations: observationRows,
  perceptualReviewSha256: sha(fs.readFileSync(path.join(stage, 'perceptual-review.json'))),
  deltaReviewSha256: sha(fs.readFileSync(path.join(stage, 'concurrent-delta-review.json'))),
});
save(path.join(stage, 'batch.r2-batch.json'), objects);
for (let wave = 0; wave < 11; wave++) {
  const ids = new Set(items.slice(wave * 50, (wave + 1) * 50).map((x) => x.id));
  const batch = objects.filter((x) => ids.has(x.assetId));
  validateBatch(batch);
  assert.equal(batch.length, 150);
  const batchPath = path.join(stage, `wave-${wave + 1}.r2-batch.json`);
  if (fs.existsSync(batchPath))
    assert.deepEqual(read(batchPath), batch, 'Never change a prepared/uploading immutable wave');
  save(batchPath, batch);
}
save(path.join(stage, 'review.next.json'), {
  collection,
  count: 550,
  baselineCount: baseline.length,
  baselineCatalogSha256: sha(baselineBytes),
  originalWebPsPreserved: 550,
  originalPdfsPreserved: 550,
  repairedPdfs: 0,
  generated: 0,
  physicalPrintProof: false,
  items,
  rows: proofs,
  sourceReviewSha256: sha(fs.readFileSync(path.join(stage, 'source-visual-review.json'))),
  identityRegistrySha256: sha(
    fs.readFileSync(path.join(root, 'data/identification/tesla-commerce-550.json')),
  ),
  exactDuplicateReview: { ...exact, rows: undefined },
  perceptualReview: perceptual,
  concurrentDeltaReview: delta,
});
console.log(
  JSON.stringify({
    status: 'PREPARED_NOT_UPLOADED',
    count: items.length,
    monochrome: items.filter((x) => x.style === 'Black & White').length,
    branded: identities.length,
    total: baseline.length + items.length,
    topics: Object.fromEntries(
      [...new Set(items.map((x) => x.topic))].map((t) => [
        t,
        items.filter((x) => x.topic === t).length,
      ]),
    ),
  }),
);
