import assert from 'node:assert/strict';
/** Preserve concurrent accepted content while adding only the reviewed incoming IDs. */
export function mergeReviewedContent({
  baseline,
  added,
  currentPublication,
  stagedPublication,
  baseTopics,
  currentExtra,
  stagedExtra,
  currentCopy,
  stagedCopy,
  currentClusters,
  stagedClusters,
}) {
  const ids = new Set(baseline.map((x) => x.id));
  assert.equal(ids.size, baseline.length, 'Duplicate accepted artwork ID');
  for (const x of added) {
    assert(!ids.has(x.id), 'Incoming artwork already exists: ' + x.id);
    ids.add(x.id);
  }
  const next = [...baseline, ...added],
    scopes = new Set(added.map((x) => x.topic)),
    incoming = new Set(added.map((x) => x.id));
  const files = new Map(currentPublication.files.map((x) => [x.assetId + ':' + x.kind, x]));
  for (const x of stagedPublication.files) {
    if (!incoming.has(x.assetId)) continue;
    const key = x.assetId + ':' + x.kind;
    assert(!files.has(key), 'Incoming representation already exists: ' + key);
    files.set(key, x);
  }
  assert.equal(
    [...files.values()].filter((x) => incoming.has(x.assetId)).length,
    added.length * 3,
    'Missing incoming representations',
  );
  const publication = { ...currentPublication, ...stagedPublication, files: [...files.values()] };
  publication.bytes = publication.files.reduce((n, x) => n + x.bytes, 0);
  const extra = structuredClone(currentExtra);
  let nextId = Math.max(0, ...baseTopics.map((x) => x.id), ...extra.map((x) => x.id)) + 1;
  for (const topic of scopes) {
    const row = stagedExtra.find((x) => x.slug === topic),
      prior = extra.find((x) => x.slug === topic);
    if (!row) throw Error('Missing reviewed topic ' + topic);
    const count = next.filter((x) => x.topic === topic).length;
    if (prior)
      prior.target_original_artworks = Math.max(
        prior.target_original_artworks ?? 0,
        row.target_original_artworks ?? 0,
        count,
      );
    else
      extra.push({
        ...row,
        id: nextId++,
        target_original_artworks: Math.max(row.target_original_artworks ?? 0, count),
      });
  }
  const copy = { ...currentCopy },
    clusters = { ...currentClusters };
  for (const topic of scopes)
    if (!baseline.some((x) => x.topic === topic)) {
      assert(stagedCopy[topic]);
      copy[topic] = stagedCopy[topic];
      clusters[topic] = stagedClusters[topic] ?? [];
    }
  return { art: next, publication, extra, copy, clusters };
}
