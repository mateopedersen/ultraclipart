import { readFileSync, writeFileSync, existsSync, mkdirSync, linkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { validateBatch } from './r2/plan.mjs';
import { validateIdentification } from './identification-review.mjs';
const root = resolve(import.meta.dirname, '..'),
  stage = join(root, 'work/imports/parade-scifi-14'),
  collection = 'owner-parade-scifi-2026-10-26';
const read = (p) => JSON.parse(readFileSync(p)),
  sha = (b) => createHash('sha256').update(b).digest('hex');
const save = (p, x) => {
  writeFileSync(p + '.tmp', JSON.stringify(x, null, 2) + '\n');
  const { renameSync } = awaitImportFs;
  renameSync(p + '.tmp', p);
};
import * as awaitImportFs from 'node:fs';
const baseline = read(join(root, 'data/art.json')),
  baseBytes = readFileSync(join(root, 'data/art.json'));
if (baseline.some((x) => x.sourceCollection === collection))
  throw Error('Already imported; preserve release history');
const extra = read(join(root, 'data/extra-topics.json')),
  baseTopics = read(join(root, 'data/topics.json')),
  topics = [...baseTopics.topics, ...extra],
  copy = read(join(root, 'data/collection-copy.json')),
  clusters = read(join(root, 'data/topic-clusters.json'));
const aliases = {
  'disney-hexed': 'hexed',
  sonic: 'sonic-the-hedgehog',
  'angry-birds-movie': 'angry-birds',
};
const topicOf = (t) => aliases[t] ?? t;
const mapping = read(join(stage, 'topic-map.json'));
if (mapping.length !== 14) throw Error('Expected 14 supplied packages');
const imported = [],
  proof = [];
let nextId = Math.max(...topics.map((x) => x.id)) + 1;
const registry = read(join(root, 'data/identification/parade-scifi.json'));
const newIds = new Set(registry.artworks.map((x) => x.id));
const releaseMap = mapping.filter((m) => registry.artworks.some((x) => x.archiveTopic === m.topic));
save(join(stage, 'release-map.json'), releaseMap);
async function waitTopic(t) {
  const review = read(join(stage, 'source-visual-review.json'));
  const contexts = {
    ...read(join(root, 'scripts/culture-tech-contexts.json')),
    ...read(join(root, 'scripts/parade-scifi-contexts.json')),
  };
  const map = mapping.find((x) => x.topic === t);
  if (review.status !== 'PASS' || review.topics[t]?.status !== 'PASS' || !contexts[t])
    throw Error('Review incomplete: ' + t);
  return { review, registry, contexts, map };
}
async function colorOf(path, record) {
  if (record.catalogColor) return record.catalogColor;
  const { data } = await sharp(path)
    .resize(64, 64, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const counts = {};
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 192) continue;
    const [r, g, b] = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255],
      max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      delta = max - min;
    let color;
    if (delta < 0.08) color = max > 0.88 ? 'White' : max < 0.25 ? 'Black' : 'Gray';
    else {
      let hue =
        max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
      hue = (hue * 60 + 360) % 360;
      const light = (max + min) / 2;
      color =
        hue < 15 || hue >= 345
          ? light > 0.7
            ? 'Pink'
            : 'Red'
          : hue < 45
            ? light < 0.42
              ? 'Brown'
              : 'Orange'
            : hue < 70
              ? 'Yellow'
              : hue < 170
                ? 'Green'
                : hue < 255
                  ? 'Blue'
                  : hue < 295
                    ? 'Purple'
                    : 'Pink';
    }
    counts[color] = (counts[color] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Gray';
}
for (const originalMap of releaseMap) {
  const archiveTopic = originalMap.topic,
    { review, registry, contexts, map } = await waitTopic(archiveTopic),
    topic = topicOf(archiveTopic),
    context = contexts[topic],
    extraction = read(join(stage, 'extraction.json')),
    preflight = read(join(stage, 'review', archiveTopic, 'preflight.json'));
  if (
    preflight.status !== 'FORMAT_PASSED' ||
    !preflight.allPairsVisuallyMatched ||
    preflight.rows.length !== map.pairs ||
    map.pairs !== 50
  )
    throw Error('Incomplete format/pair verification: ' + archiveTopic);
  for (const sheet of review.topics[archiveTopic].sheets) {
    if (sha(readFileSync(join(stage, sheet.path))) !== sheet.sha256)
      throw Error('Source review sheet changed');
  }
  const duplicates = read(join(stage, 'duplicate-review.json'));
  if (duplicates.status !== 'PASS' || duplicates.baselineCatalogSha256 !== sha(baseBytes))
    throw Error('Stale exact duplicate review');
  const similarity = read(join(stage, 'perceptual-review.json'));
  for (const [index, pair] of similarity.candidates.entries())
    if (pair.paths[0].includes('/' + archiveTopic + '-clipart/')) {
      if (review.perceptualDecisions?.[String(index)]?.status !== 'DISTINCT_COMPOSITION')
        throw Error('Unreviewed visual similarity ' + index);
    }
  const target = join(root, 'public/catalog', topic);
  mkdirSync(target, { recursive: true });
  const batch = [],
    items = [];
  for (const checked of preflight.rows.filter((x) => newIds.has(x.id))) {
    const id = checked.id,
      record = registry.artworks.find((x) => x.id === id),
      source = join(stage, 'extracted', map.folder),
      webp = join(source, 'webp', id + '.webp');
    if (
      record?.status !== 'PASS' ||
      !record.reviewedFromPixels ||
      record.sourceSha256 !== sha(readFileSync(webp))
    )
      throw Error('Missing or changed source identity ' + id);
    const duplicateRow = duplicates.rows.find((x) => x.id === id && x.new);
    if (!duplicateRow || duplicateRow.sha256 !== record.sourceSha256)
      throw Error('This source lacks exact duplicate verification ' + id);
    if (!record.metadata.title || !record.metadata.alt || !record.metadata.description)
      throw Error('Incomplete scene metadata');
    const generated = extraction.generated?.some((x) => x.id === id),
      repaired = extraction.repairs?.some((x) => x.id === id),
      mono = record.style === 'Black & White';
    const identity = ['generic-subject', 'political-symbol'].includes(record.level)
      ? null
      : validateIdentification({
          artwork: { id, ...record.metadata },
          sourceBytes: readFileSync(webp),
          record,
        });
    const item = {
      id,
      ...record.metadata,
      ...(identity ? { productIdentity: identity.productIdentity } : {}),
      style: record.style ?? 'Color',
      visualStyle:
        record.visualStyle ?? (mono ? 'Black-and-white illustration' : 'Full-color illustration'),
      discovery: record.discovery ?? { cute: false },
      topic,
      color: await colorOf(webp, record),
      orientation:
        checked.width === checked.height
          ? 'Square'
          : checked.width > checked.height
            ? 'Landscape'
            : 'Portrait',
      width: checked.width,
      height: checked.height,
      sourceType: 'raster',
      svg: null,
      sourceCollection: collection,
      sourceArchiveTopic: archiveTopic,
      provenance: generated
        ? extraction.compositionReplacements?.some((x) => x.id === id)
          ? 'Replacement composition drawn after visual review; retained original artwork ID.'
          : 'Completion drawing produced for this reviewed collection.'
        : repaired
          ? 'Owner-supplied WebP retained; matching PDF rebuilt after an invalid image-stream encoding was found.'
          : 'Owner-supplied collection; original PDF and WebP bytes preserved.',
      productionMethod: generated ? 'generated-raster' : 'owner-supplied',
      licenseStatus: 'OWNER_APPROVED_PERSONAL_EDUCATIONAL_ONLY',
      license:
        'Free personal and educational use. Commercial use and resale as clipart are prohibited.',
      licenseApprovedAt: '2026-10-26',
      reviewStatus: 'FORMAT_AND_PAIR_REVIEW_PASSED',
      published: true,
      indexable: true,
      createdAt: extraction.extractedAt,
      revision: 1,
      formats: ['WEBP', 'PDF'],
      printProfile: checked.images[0].profile,
      pdfColorSpace: checked.images[0].colorSpace,
      pdfPage: checked.pagePoints.map((x) => (x / 72).toFixed(3)).join(' × ') + ' in',
      alpha: true,
      files: {},
    };
    for (const kind of ['webp', 'pdf']) {
      const path = join(source, kind, id + '.' + kind),
        body = readFileSync(path);
      if (sha(body) !== checked.hashes[kind] || body.length !== checked[kind + 'Bytes'])
        throw Error('Source changed after pair verification');
      const dest = join(target, id + '.' + kind);
      if (existsSync(dest)) {
        if (sha(readFileSync(dest)) !== sha(body)) throw Error('Destination collision');
      } else linkSync(path, dest);
    }
    const thumb = join(target, id + '-thumb.webp');
    if (!existsSync(thumb))
      await sharp(webp)
        .resize(440, 440, { fit: 'inside', withoutEnlargement: true })
        .toColourspace('srgb')
        .webp({ quality: 94, alphaQuality: 100, effort: 6 })
        .toFile(thumb);
    const tm = await sharp(thumb).metadata();
    if (!tm.hasAlpha) throw Error('Thumbnail lost transparency');
    for (const kind of ['webp', 'pdf', 'thumb']) {
      const name = id + (kind === 'thumb' ? '-thumb.webp' : '.' + kind),
        body = readFileSync(join(target, name)),
        h = sha(body),
        representation = kind === 'thumb' ? 'thumbnail' : kind;
      item[kind] = `/catalog/${topic}/${name}`;
      item.files[kind] = { bytes: body.length, sha256: h };
      batch.push({
        assetId: id,
        sourceType: 'raster',
        kind: representation,
        bucket: 'ultraclipart-media',
        jurisdiction: 'default',
        key: `${topic}/${id}.${representation}.${h.slice(0, 16)}.${kind === 'pdf' ? 'pdf' : 'webp'}`,
        path: `public/catalog/${topic}/${name}`,
        bytes: body.length,
        sha256: h,
      });
    }
    items.push(item);
    proof.push({
      id,
      archiveTopic,
      topic,
      hashes: checked.hashes,
      pdfBytes: checked.pdfBytes,
      width: checked.width,
      height: checked.height,
      pdfAlphaExact: checked.pdfAlphaExact,
      pdfAlphaExactToPrintSource: checked.pdfAlphaExactToPrintSource,
      printSourceSha256: checked.printSourceSha256,
      printDimensions: checked.printDimensions,
      proofSha256: checked.proofSha256,
      ppi: checked.ppi,
      pairedWebp: checked.pairedWebp,
      meanRgbDifference: checked.meanRgbDifference,
    });
  }
  items.sort((a, b) => a.id.localeCompare(b.id));
  batch.sort((a, b) => a.assetId.localeCompare(b.assetId) || a.kind.localeCompare(b.kind));
  validateBatch(batch);
  if (
    new Set(items.map((x) => x.title)).size !== items.length ||
    new Set(items.map((x) => x.alt)).size !== items.length
  )
    throw Error('Repeated metadata within source package');
  imported.push(...items);
  const isNewTopic = !topics.some((x) => x.slug === topic);
  if (isNewTopic) {
    const row = {
      id: nextId++,
      keyword: context.label + ' clipart',
      slug: topic,
      cluster: context.cluster,
      wave: 'OWNER_COLLECTION',
      target_original_artworks: 50,
      focus_note: context.intro,
      supplemental: true,
    };
    topics.push(row);
    extra.push(row);
  } else if (topics.find((x) => x.slug === topic).cluster !== context.cluster)
    throw Error('Existing topic category mismatch');
  const selected = imported.filter((x) => x.topic === topic);
  extra.find((x) => x.slug === topic).target_original_artworks =
    baseline.filter((x) => x.topic === topic).length + selected.length;
  if (isNewTopic)
    copy[topic] = {
      description: `{{artworkCount}} ${context.label} illustrations: ${context.summary}. Transparent WebP and matching printable PDF downloads.`,
      lead: context.lead,
      intro: context.intro,
      featured: selected
        .filter((x) => x.style === 'Color')
        .slice(0, 5)
        .map((x) => x.id),
      chips: context.chips.map((query) => ({ label: query, query })),
      heading: 'Explore the ' + context.label + ' illustrations',
      paragraphs: [
        context.note,
        'Each design is one transparent raster image. In Clipart Studio you can resize or crop it, position it with other artwork and add your own text. Individual objects inside the illustration are not separate vector layers.',
      ],
      print:
        'WebP and PDF are separate downloads. Check the original image dimensions and PDF page size on each artwork page. The PDF uses CMYK image data at 300 pixels per inch; print at actual size to preserve that scale.',
      related: context.related,
    };
  if (isNewTopic) clusters[topic] = context.secondary ?? [];
  save(join(stage, archiveTopic + '.r2-batch.json'), batch);
  save(join(stage, archiveTopic + '.catalog.next.json'), [...baseline, ...imported]);
  save(join(stage, 'art.next.json'), [...baseline, ...imported]);
  save(join(stage, 'extra-topics.next.json'), extra);
  save(join(stage, 'collection-copy.next.json'), copy);
  save(join(stage, 'topic-clusters.next.json'), clusters);
  save(join(stage, 'review.next.json'), {
    collection,
    count: imported.length,
    ownerArchives: extraction.archives,
    repairs: extraction.repairs ?? [],
    generated: extraction.generated ?? [],
    reviewerType: 'AI_AGENT_NOT_HUMAN',
    physicalPrintProof: false,
    identityRegistrySha256: sha(readFileSync(join(root, 'data/identification/parade-scifi.json'))),
    rows: proof,
  });
  console.log(
    JSON.stringify({
      archiveTopic,
      topic,
      artworks: items.length,
      total: baseline.length + imported.length,
      status: 'PREPARED_NOT_PUBLISHED',
    }),
  );
}
if (imported.length !== 454) throw Error('Incomplete supplied/completion batch');
console.log('ALL_454_NEW_ARTWORKS_PREPARED');
