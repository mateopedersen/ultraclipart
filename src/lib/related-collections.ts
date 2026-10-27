/** Use editorial relationships, never a broad-cluster or text-overlap guess. */
export function relatedCollectionSlugs(
  source: string,
  relations: Record<string, string[]>,
  indexableTopics: ReadonlySet<string>,
): string[] {
  return [...new Set(relations[source] ?? [])]
    .filter((slug) => slug !== source && indexableTopics.has(slug))
    .slice(0, 6);
}
