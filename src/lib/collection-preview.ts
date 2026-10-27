import { publishedArt } from './catalog';

const groups = new Map<string, typeof publishedArt>();
for (const artwork of publishedArt) {
  const group = groups.get(artwork.topic) ?? [];
  group.push(artwork);
  groups.set(artwork.topic, group);
}

/** Real published examples from this collection; never a decorative substitute. */
export function collectionPreview(topic: string, sourceId?: string) {
  const all = groups.get(topic) ?? [];
  const others = all.filter((artwork) => artwork.id !== sourceId);
  const candidates = others.length ? others : all;
  if (candidates.length <= 3) return candidates;
  return [
    candidates[0],
    candidates[Math.floor(candidates.length / 3)],
    candidates[Math.floor((candidates.length * 2) / 3)],
  ];
}
