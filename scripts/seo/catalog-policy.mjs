/** Publication checks operate on source data, before HTML or social assets are built. */
export function auditCatalogPolicy({
  artwork,
  topics,
  relations,
  metadataReviews = {},
  browseGroups = [],
  primaryCategories = {},
}) {
  const errors = [];
  const registered = new Set(topics.map((topic) => topic.slug));
  const approvedGroups = new Set(browseGroups);
  for (const [slug, group] of Object.entries(primaryCategories)) {
    if (!registered.has(slug)) errors.push(`Primary category references unknown subject: ${slug}`);
    if (approvedGroups.size && !approvedGroups.has(group))
      errors.push(`${slug}: unregistered primary category ${group}`);
  }
  const seenTopics = new Set();
  for (const topic of topics) {
    if (seenTopics.has(topic.slug)) errors.push(`Duplicate subject registration: ${topic.slug}`);
    seenTopics.add(topic.slug);
    if (approvedGroups.size && !approvedGroups.has(topic.browseCluster ?? topic.cluster))
      errors.push(`${topic.slug}: choose a registered browse group before publishing`);
  }
  const ids = new Set();
  const counts = new Map();
  const metadata = { title: new Map(), alt: new Map(), description: new Map() };
  const published = artwork.filter((item) => item.published && item.indexable);
  const text = (value) =>
    typeof value === 'string' &&
    value.trim().length > 5 &&
    !/<\/?(?:script|img|iframe)\b|\bundefined\b|\[object Object\]/i.test(value);
  for (const item of published) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) || ids.has(item.id))
      errors.push(`Artwork has an unsafe or duplicate ID: ${item.id}`);
    ids.add(item.id);
    if (!registered.has(item.topic)) errors.push(`${item.id}: unregistered subject ${item.topic}`);
    for (const field of ['title', 'alt', 'description']) {
      if (!text(item[field])) {
        errors.push(`${item.id}: add a reviewed, descriptive ${field}`);
        continue;
      }
      const key = item[field]
        .normalize('NFKC')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[.!]$/, '')
        .toLowerCase();
      const previous = metadata[field].get(key);
      if (previous)
        errors.push(
          `${item.id}: duplicate ${field} from ${previous}; describe this image's own visible content`,
        );
      else metadata[field].set(key, item.id);
    }
    const review = metadataReviews[item.id];
    if (
      review &&
      (review.sourceSha256 !== item.files?.webp?.sha256 ||
        ['title', 'alt', 'description'].some((field) => review[field] !== item[field]))
    )
      errors.push(
        `${item.id}: image or reviewed metadata changed; renew its source-bound visual review`,
      );
    counts.set(item.topic, (counts.get(item.topic) ?? 0) + 1);
  }
  const ready = new Set([...counts].filter(([, count]) => count >= 50).map(([slug]) => slug));
  for (const source of ready) {
    const targets = relations[source];
    if (!Array.isArray(targets)) {
      errors.push(
        `${source}: add reviewed collection slugs to data/topic-relations.json; use [] explicitly if no relevant collection exists`,
      );
      continue;
    }
    if (targets.length > 6 || new Set(targets).size !== targets.length)
      errors.push(`${source}: use at most six distinct related collections`);
    for (const target of targets) {
      if (
        source === target ||
        !registered.has(target) ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target)
      )
        errors.push(
          `${source}: invalid collection target ${target}; use a registered subject slug, never a search URL`,
        );
    }
  }
  // A temporarily withdrawn or incomplete destination is deliberately suppressed by
  // the renderer. Keep its reviewed relationship for a possible later re-release.
  const suppressed = [...ready].flatMap((source) =>
    (Array.isArray(relations[source]) ? relations[source] : [])
      .filter((target) => registered.has(target) && !ready.has(target))
      .map((target) => ({ source, target })),
  );
  return { artwork: published.length, subjects: ready.size, errors, suppressed };
}

export function assertCatalogPolicy(input) {
  const audit = auditCatalogPolicy(input);
  if (audit.errors.length)
    throw new Error(`Catalog SEO publication check failed:\n${audit.errors.join('\n')}`);
  return audit;
}
