type RecentArtwork = {
  topic: string;
  createdAt: string;
  published?: boolean;
  indexable?: boolean;
};

/** Newest-first input, one design per subject, with category variety within
 * the latest week's releases. Older subjects fill only the remaining spaces. */
export function diverseRecentArtwork<T extends RecentArtwork>(
  newestFirst: readonly T[],
  categoryForTopic: (topic: string) => string | undefined,
  limit = 12,
): T[] {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid gallery limit');
  if (limit === 0) return [];
  const seen = new Set<string>();
  const subjects = newestFirst.filter((item) => {
    if (item.published === false || item.indexable === false || seen.has(item.topic)) return false;
    seen.add(item.topic);
    return true;
  });
  const timestamps = subjects.map((item) => Date.parse(item.createdAt));
  const latest = timestamps.reduce(
    (max, time) => (Number.isFinite(time) ? Math.max(max, time) : max),
    -Infinity,
  );
  const cutoff = latest - 7 * 24 * 60 * 60_000;
  const recent = subjects.filter((_, index) => timestamps[index] >= cutoff);
  const older = subjects.filter((_, index) => !(timestamps[index] >= cutoff));
  const result: T[] = [];
  for (const cohort of [recent, older]) {
    const groups = new Map<string, { items: T[]; cursor: number }>();
    for (const item of cohort) {
      const category = categoryForTopic(item.topic) || item.topic;
      if (!groups.has(category)) groups.set(category, { items: [], cursor: 0 });
      groups.get(category)!.items.push(item);
    }
    let added = true;
    while (added && result.length < limit) {
      added = false;
      for (const group of groups.values()) {
        if (result.length === limit) break;
        if (group.cursor === group.items.length) continue;
        result.push(group.items[group.cursor++]);
        added = true;
      }
    }
  }
  return result;
}
