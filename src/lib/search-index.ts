import { normalizeQuery, type SearchArtwork } from './search.ts';

export interface SearchCard {
  id: string;
  title: string;
  alt: string;
  thumb: string;
  webp: string;
  pdf?: string;
  editable?: boolean;
}
export interface SearchTopic {
  slug: string;
  keyword: string;
}
export interface SearchManifest {
  schema: 1;
  version: string;
  total: number;
  pageChunk: number;
  cardChunk?: number;
  tokenBuckets: number;
  lexiconLengths: number[];
  facets: string[];
  topics: SearchTopic[];
}
export interface RankedPage {
  ids: string[];
  ordinals: number[];
}
export interface SearchBuild {
  manifest: SearchManifest;
  files: Map<string, unknown>;
}
// Larger rank and ordinal pages keep Pages' static file count below its limit
// as the catalog grows, while a cold first browse still stays below 25 KiB.
export const SEARCH_CHUNK = 256;
export const TOKEN_BUCKETS = 256;
// Eight adjacent cards share one file: a cold eight-card browse transfers no
// extra card records, while the catalog no longer needs one Pages file per ID.
export const CARD_CHUNK = 8;

// FNV-1a keeps the number of generated files bounded as vocabulary grows.
export function tokenBucket(token: string): string {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) hash = Math.imul(hash ^ token.charCodeAt(i), 16777619);
  return ((hash >>> 0) % TOKEN_BUCKETS).toString(16).padStart(2, '0');
}
export function cardMetadata(item: SearchArtwork & SearchCard): SearchCard {
  return {
    id: item.id,
    title: item.title,
    alt: item.alt,
    thumb: item.thumb,
    webp: item.webp,
    ...(item.pdf ? { pdf: item.pdf } : {}),
    ...(item.editable === false ? { editable: false } : {}),
  };
}
export function buildSearchIndex(
  source: (SearchArtwork & SearchCard)[],
  topics: SearchTopic[],
  version: string,
): SearchBuild {
  const byId = new Map<string, SearchArtwork & SearchCard>();
  for (const item of source) if (!byId.has(item.id)) byId.set(item.id, item);
  const unique = [...byId.values()];
  const items = unique.sort((a, b) => a.title.localeCompare(b.title, 'en'));
  const files = new Map<string, unknown>();
  const buckets = new Map<string, Record<string, number[]>>();
  const lexicons = new Map<number, Set<string>>();
  const facets = new Map<string, number[]>();
  const locations = new Map<string, Record<string, number>>();
  const addFacet = (name: string, ordinal: number) => {
    const values = facets.get(name) ?? [];
    values.push(ordinal);
    facets.set(name, values);
  };
  items.forEach((item, ordinal) => {
    const key = tokenBucket(item.id);
    const location = locations.get(key) ?? Object.create(null);
    location[item.id] = ordinal;
    locations.set(key, location);
    const strong = new Set(normalizeQuery(`${item.topic} ${item.title}`));
    const words = new Set(
      normalizeQuery(
        `${item.topic} ${item.title} ${item.description} ${item.alt} ${item.cluster ?? ''}`,
      ),
    );
    for (const word of words) {
      const key = tokenBucket(word),
        bucket = buckets.get(key) ?? Object.create(null);
      // One integer stores the ordinal and exact-match weight (5 or 2).
      (bucket[word] ??= []).push(ordinal * 8 + (strong.has(word) ? 5 : 2));
      buckets.set(key, bucket);
      const vocabulary = lexicons.get(word.length) ?? new Set<string>();
      vocabulary.add(word);
      lexicons.set(word.length, vocabulary);
    }
    for (const key of ['style', 'color', 'orientation'] as const)
      addFacet(`${key}/${item[key].toLowerCase()}`, ordinal);
    if (['outline', 'black & white'].includes(item.style.toLowerCase()))
      addFacet('print/monochrome', ordinal);
    for (const format of new Set(item.formats?.map((value) => value.toLowerCase()) ?? []))
      addFacet(`format/${format}`, ordinal);
    if (typeof item.alpha === 'boolean')
      addFacet(`background/${item.alpha ? 'transparent' : 'opaque'}`, ordinal);
    addFacet(`topic/${item.topic}`, ordinal);
  });
  for (let offset = 0; offset < items.length; offset += CARD_CHUNK)
    files.set(
      `${version}/items/${offset / CARD_CHUNK}`,
      items.slice(offset, offset + CARD_CHUNK).map(cardMetadata),
    );
  for (let bucket = 0; bucket < TOKEN_BUCKETS; bucket++) {
    const key = bucket.toString(16).padStart(2, '0');
    files.set(`${version}/locations/${key}`, locations.get(key) ?? {});
  }
  // Empty buckets exist too: a missing word is a normal zero-result query, not a 404.
  for (let bucket = 0; bucket < TOKEN_BUCKETS; bucket++) {
    const key = bucket.toString(16).padStart(2, '0');
    files.set(`${version}/tokens/${key}`, buckets.get(key) ?? {});
  }
  for (const [length, words] of lexicons)
    files.set(`${version}/lexicon/${length}`, [...words].sort());
  for (const [name, ordinals] of facets) files.set(`${version}/facets/${name}`, ordinals);
  const titleOrder = items.map((_, i) => i);
  const newestOrder = [...titleOrder].sort(
    (a, b) => (items[b].createdAt ?? '').localeCompare(items[a].createdAt ?? '') || a - b,
  );
  for (const [sort, order] of [
    ['title', titleOrder],
    ['newest', newestOrder],
  ] as const) {
    for (let offset = 0; offset < Math.max(1, order.length); offset += SEARCH_CHUNK) {
      const ordinals = order.slice(offset, offset + SEARCH_CHUNK);
      files.set(`${version}/ranked/${sort}/${offset / SEARCH_CHUNK}`, {
        ids: ordinals.map((i) => items[i].id),
        ordinals,
      });
    }
  }
  // Only needed for filtered newest ordering, never for initial browsing.
  files.set(`${version}/order/newest`, newestOrder);
  // Ordinal-to-ID pages let query matches resolve only the visible page's cards.
  for (let offset = 0; offset < items.length; offset += SEARCH_CHUNK)
    files.set(
      `${version}/ids/${offset / SEARCH_CHUNK}`,
      items.slice(offset, offset + SEARCH_CHUNK).map((item) => item.id),
    );
  const manifest: SearchManifest = {
    schema: 1,
    version,
    total: items.length,
    pageChunk: SEARCH_CHUNK,
    cardChunk: CARD_CHUNK,
    tokenBuckets: TOKEN_BUCKETS,
    lexiconLengths: [...lexicons.keys()].sort((a, b) => a - b),
    facets: [...facets.keys()].sort(),
    topics: topics.map(({ slug, keyword }) => ({ slug, keyword })),
  };
  files.set('manifest', manifest);
  return { manifest, files };
}
