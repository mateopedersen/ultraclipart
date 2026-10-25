/** Keep future generated topics in the original plan covered automatically. */
export function originalRasterTargets(catalog, topics) {
  if (!Array.isArray(catalog) || !Array.isArray(topics) || topics.length === 0)
    throw new Error('Original raster selection requires a catalog and topic plan');
  const slugs = new Set(topics.map((topic) => topic?.slug));
  if (
    slugs.size !== topics.length ||
    [...slugs].some((slug) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug ?? ''))
  )
    throw new Error('Original topic identities must be unique valid slugs');
  return catalog.filter(
    (art) =>
      art.sourceType === 'raster' &&
      art.productionMethod !== 'owner-supplied' &&
      slugs.has(art.topic),
  );
}

/** Partition the complete target list, never the checks performed on each target. */
export function shardRasterTargets(targets, env = process.env) {
  const count = env.RASTER_SHARD_COUNT;
  const index = env.RASTER_SHARD_INDEX;
  if (count === undefined && index === undefined) return targets;
  if (!/^[0-9]+$/.test(count ?? '') || !/^[0-9]+$/.test(index ?? ''))
    throw new Error('Both raster shard count and index must be explicit integers');
  const total = Number(count),
    part = Number(index);
  if (
    !Number.isSafeInteger(total) ||
    total < 1 ||
    total > 64 ||
    !Number.isSafeInteger(part) ||
    part < 0 ||
    part >= total
  )
    throw new Error('Raster shard index/count outside supported bounds');
  const selected = targets.filter((_, offset) => offset % total === part);
  if (!selected.length) throw new Error('Empty raster shard cannot count as passed validation');
  return selected;
}
