import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanLegacyCopy, readEditorialAudit, resolveArtworkCopy } from './artwork-editorial.mjs';

// This compares a named Git baseline with the checked local catalog. It does not
// assert that the baseline or the current revision is deployed.
const root = resolve(import.meta.dirname, '..');
const baseline = process.argv[2] ?? 'origin/main';
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const fromGit = (path) =>
  JSON.parse(
    execFileSync('git', ['show', `${baseline}:${path}`], {
      cwd: root,
      maxBuffer: 100 * 1024 * 1024,
      encoding: 'utf8',
    }),
  );
const baseRevision = execFileSync('git', ['rev-parse', baseline], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const currentRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const baseCatalog = new Map(fromGit('data/art.json').map((item) => [item.id, item]));
const baseReviews = new Map(
  fromGit('data/editorial/reviews.json').artworks.map((record) => [record.id, record]),
);
const catalog = read('data/art.json');
const registry = read('data/editorial/reviews.json');
const reviews = new Map(registry.artworks.map((record) => [record.id, record]));
const audit = readEditorialAudit(root);
const keys = ['title', 'alt', 'description'];
const counts = {
  total: catalog.length,
  reviewed: audit.reviewed,
  awaiting: audit.awaitingImageReview,
  addedSinceBaseline: 0,
  removedSinceBaseline: 0,
  titleChanged: 0,
  altChanged: 0,
  descriptionChanged: 0,
  anyCopyChanged: 0,
  sourceIdentityChanged: 0,
};
const topics = {};
const records = catalog.map((item) => {
  const old = baseCatalog.get(item.id);
  const review = reviews.get(item.id);
  const current = resolveArtworkCopy(item, review);
  const previousReview = baseReviews.get(item.id);
  // Previously reviewed copy is explicit. Legacy copy below is reconstructed by
  // the current exact-sentence cleaner, so the report calls it an approximation.
  const previous = old ? (previousReview?.copy ?? cleanLegacyCopy(old)) : null;
  const changed = Object.fromEntries(
    keys.map((k) => [k, Boolean(previous && previous[k] !== current[k])]),
  );
  if (!old) counts.addedSinceBaseline++;
  for (const k of keys)
    if (changed[k])
      counts[k === 'title' ? 'titleChanged' : k === 'alt' ? 'altChanged' : 'descriptionChanged']++;
  if (Object.values(changed).some(Boolean)) counts.anyCopyChanged++;
  if (
    old &&
    JSON.stringify(old.productIdentity ?? null) !== JSON.stringify(item.productIdentity ?? null)
  )
    counts.sourceIdentityChanged++;
  const topic = (topics[item.topic] ??= {
    total: 0,
    reviewed: 0,
    addedSinceBaseline: 0,
    anyCopyChanged: 0,
  });
  topic.total++;
  if (review) topic.reviewed++;
  if (!old) topic.addedSinceBaseline++;
  if (Object.values(changed).some(Boolean)) topic.anyCopyChanged++;
  return {
    id: item.id,
    topic: item.topic,
    url: `/art/${item.id}/`,
    reviewStatus: review?.status ?? 'legacy-awaiting-image-review',
    sourceImageSha256: item.files?.webp?.sha256 ?? null,
    reviewedAt: review?.reviewedAt ?? null,
    baselineKind: old
      ? previousReview
        ? 'explicit-review'
        : 'legacy-cleanup-reconstruction'
      : 'new-item',
    previous,
    current,
    changed,
    observations: review?.observations ?? [],
    references: review?.references ?? [],
  };
});
const currentIds = new Set(catalog.map((item) => item.id));
const removed = [...baseCatalog.keys()].filter((id) => !currentIds.has(id));
counts.removedSinceBaseline = removed.length;
const dir = resolve(root, 'work/editorial-review/reports');
mkdirSync(dir, { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  baseRevision,
  currentRevision,
  note: 'Comparison to a Git baseline, not proof of live deployment. Earlier legacy text is reconstructed with the current approved cleaner; previously reviewed text is recorded explicitly. New items have no previous copy.',
  counts,
  topics,
  removed,
  records,
};
writeFileSync(resolve(dir, 'editorial-details.json'), JSON.stringify(report, null, 2) + '\n');
const lines = [
  `# UltraClipart editorial report`,
  ``,
  `Generated: ${report.generatedAt}`,
  `Baseline: ${baseRevision}`,
  `Current checked revision: ${currentRevision}`,
  ``,
  `This is a source comparison, not proof of deployment. Legacy baseline text is reconstructed using the current cleaner; the full per-image before/after, evidence, image checksums and references are in editorial-details.json.`,
  ``,
  ...Object.entries(counts).map(([key, value]) => `- ${key}: ${value}`),
  ``,
  `## By topic`,
  ``,
  ...Object.entries(topics)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([name, v]) =>
        `- ${name}: ${v.total} images, ${v.reviewed} reviewed, ${v.anyCopyChanged} changed, ${v.addedSinceBaseline} added since baseline.`,
    ),
];
writeFileSync(resolve(dir, 'editorial-summary.md'), lines.join('\n') + '\n');
console.log(
  JSON.stringify({
    counts,
    summary: resolve(dir, 'editorial-summary.md'),
    details: resolve(dir, 'editorial-details.json'),
  }),
);
