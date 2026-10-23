// Replacement authorization is bound to the exact catalog revision reviewed.
// Replacing an image preserves its URL and topic, but never its old provenance.
export function replacementFor(plan, meta, catalog, review) {
  if (!plan.replacementReview) return null;
  const prior = catalog.find((item) => item.id === meta.id);
  const decisions = review.decisions.filter((row) => row.replaceId === meta.id);
  if (decisions.length !== 1 || !prior)
    throw new Error('Replacement requires one reviewed existing artwork');
  const decision = decisions[0];
  if (
    decision.decision !== 'REPLACE_NEAR_COMPOSITION' ||
    decision.topic !== plan.topic ||
    prior.topic !== plan.topic ||
    decision.priorWebpSha256 !== prior.files.webp.sha256 ||
    decision.priorPdfSha256 !== prior.files.pdf.sha256 ||
    prior.revision !== meta.replacesRevision
  )
    throw new Error('Replacement review is stale or belongs to another topic');
  return prior;
}

export function mergeGeneratedWave(catalog, imported, replacing) {
  const ids = new Set(imported.map((item) => item.id));
  if (ids.size !== imported.length) throw new Error('Duplicate wave ID');
  const existing = new Set(catalog.map((item) => item.id));
  if (imported.some((item) => existing.has(item.id) !== replacing))
    throw new Error(replacing ? 'Replacement target missing' : 'Catalog collision');
  const next = replacing
    ? catalog.map((item) => imported.find((replacement) => replacement.id === item.id) ?? item)
    : [...catalog, ...imported];
  if (new Set(next.map((item) => item.id)).size !== next.length)
    throw new Error('Catalog collision');
  return next;
}
