export interface CollectionSubject {
  slug: string;
  name: string;
  count: number;
  sample: { thumb: string; thumbSrcSet?: string; alt: string; title: string };
}
export interface CollectionArtwork {
  id: string;
  topic: string;
  published?: boolean;
  indexable?: boolean;
}
/** Input artwork is already sorted by the site's canonical publication order. */
export function latestSubjectCollections(
  subjects: CollectionSubject[],
  orderedArt: CollectionArtwork[],
  limit = 8,
) {
  const bySlug = new Map(subjects.map((subject) => [subject.slug, subject]));
  const seen = new Set<string>();
  const result = [];
  for (const art of orderedArt) {
    if (art.published === false || art.indexable === false || seen.has(art.topic)) continue;
    const subject = bySlug.get(art.topic);
    if (!subject || subject.count < 1) continue;
    seen.add(art.topic);
    result.push({
      slug: subject.slug,
      name: subject.name,
      count: subject.count,
      sample: {
        thumb: subject.sample.thumb,
        thumbSrcSet: subject.sample.thumbSrcSet,
        alt: subject.sample.alt,
        title: subject.sample.title,
      },
      latestArtworkId: art.id,
      href: `/clipart/${subject.slug}/`,
    });
    if (result.length >= limit) break;
  }
  return result;
}
