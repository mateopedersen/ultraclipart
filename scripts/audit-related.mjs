import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { loadTypescript } from '../tests/helpers/typescript.mjs';
const { RelatedIndex, CANDIDATE_LIMIT } = await loadTypescript('src/lib/related/engine.ts');
const catalog = JSON.parse(await readFile('data/art.json', 'utf8'));
const start = performance.now(),
  index = new RelatedIndex(catalog),
  normalizedMs = performance.now() - start;
const counts = {},
  issues = {},
  examples = [],
  times = [],
  baselineTimes = [];
let maxCandidates = 0,
  maxSnapshotBytes = 0,
  recommendationPages = 0,
  totalCards = 0;
for (const item of catalog) {
  const p = index.profiles.get(item.id);
  counts[p.status] = (counts[p.status] ?? 0) + 1;
  for (const issue of p.issues) issues[issue] = (issues[issue] ?? 0) + 1;
  const before = performance.now(),
    result = index.snapshot(item.id);
  times.push(performance.now() - before);
  const cards = [...result.alternatives, ...result.companions];
  if (cards.length) recommendationPages++;
  totalCards += cards.length;
  maxCandidates = Math.max(maxCandidates, result.examined);
  maxSnapshotBytes = Math.max(maxSnapshotBytes, Buffer.byteLength(JSON.stringify(result)));
  if (examples.length < 12 && !examples.some((e) => e.topic === item.topic) && cards.length)
    examples.push({
      source: item.id,
      topic: item.topic,
      subject: p.subject.id,
      alternatives: result.alternatives.slice(0, 8).map((c) => ({ id: c.id, reason: c.reason })),
      companions: result.companions.slice(0, 4).map((c) => ({ id: c.id, reason: c.reason })),
    });
}
for (const item of catalog.slice(0, 300)) {
  const start = performance.now();
  catalog
    .filter((a) => a.id !== item.id)
    .sort((a, b) => Number(b.topic === item.topic) - Number(a.topic === item.topic))
    .slice(0, 5);
  baselineTimes.push(performance.now() - start);
}
const percentile = (list, p) =>
  [...list].sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * p))];
const source = catalog.find((a) => a.id === 'apple-and-dried-rings-crayon-clipart');
const dense = Array.from({ length: 50000 }, (_, i) => ({
  ...source,
  id: `scale-${i}`,
  files: Object.fromEntries(
    Object.entries(source.files).map(([kind, f]) => [kind, { ...f, sha256: `test-${i}-${kind}` }]),
  ),
}));
const denseStart = performance.now(),
  denseIndex = new RelatedIndex([source, ...dense]),
  denseBuildMs = performance.now() - denseStart;
const denseTimes = [];
for (let i = 0; i < 300; i++) {
  const t = performance.now();
  denseIndex.snapshot(source.id);
  denseTimes.push(performance.now() - t);
}
const report = {
  timestamp: new Date().toISOString(),
  version: index.version,
  catalogArtworks: catalog.length,
  counts,
  issues,
  recommendationPages,
  totalCards,
  normalizedMs,
  maxCandidates,
  configuredCandidateLimit: CANDIDATE_LIMIT,
  maxSnapshotBytes,
  queryMs: { p50: percentile(times, 0.5), p95: percentile(times, 0.95) },
  previousAlgorithmMs: {
    p50: percentile(baselineTimes, 0.5),
    p95: percentile(baselineTimes, 0.95),
    scannedPerQuery: catalog.length,
  },
  denseSubject: {
    artworks: 50001,
    normalizationMs: denseBuildMs,
    examined: denseIndex.snapshot(source.id).examined,
    p50Ms: percentile(denseTimes, 0.5),
    p95Ms: percentile(denseTimes, 0.95),
  },
  examples,
  reference: index.snapshot(source.id),
  reviewQueue: [...index.profiles.values()]
    .filter((p) => ['needs_review', 'unclassified'].includes(p.status))
    .map((p) => ({ id: p.item.id, topic: p.item.topic, status: p.status, issues: p.issues })),
  limitations: [
    'Classification uses supplied metadata, not automated visual recognition.',
    'Astro still performs a full static publication; there is no incremental deploy claim.',
    'Bounded postings are a relevance shortlist, not exhaustive retrieval of every item in a very dense subject.',
    'Event hooks are local CustomEvents; no analytics collector or conversion measurement is installed.',
  ],
};
await mkdir('reports/related', { recursive: true });
await writeFile('reports/related/audit.json', JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      ...report,
      reviewQueue: report.reviewQueue.length,
      examples: report.examples.length,
      reference: {
        alternatives: report.reference.alternatives.length,
        companions: report.reference.companions.length,
      },
    },
    null,
    2,
  ),
);
