import { isMonochrome } from './monochrome.ts';
import { newestFirst } from './publication-order.ts';
import {
  normalizeQuery,
  oneEditAway,
  queryTerms,
  termVariants,
  relevanceScore,
  type TermMatch,
} from './search-language.ts';
export { normalizeQuery, oneEditAway, queryTerms } from './search-language.ts';
export interface SearchArtwork {
  id: string;
  title: string;
  topic: string;
  description: string;
  alt: string;
  style: string;
  color: string;
  orientation: string;
  formats?: string[];
  alpha?: boolean;
  createdAt?: string;
  publishedAt?: string;
  firstPublishedAt?: string;
  cluster?: string;
  published?: boolean;
  monochrome?: boolean;
  monochromeKind?: string | null;
  collections?: string[];
  keywords?: string[];
  topicLabel?: string;
}
export interface SearchState {
  q: string;
  style: string;
  color: string;
  format: string;
  orientation: string;
  background: string;
  sort: string;
  page: number;
  size: number;
  type: string;
}
export const defaults: SearchState = {
  q: '',
  style: '',
  color: '',
  format: '',
  orientation: '',
  background: '',
  sort: 'relevance',
  page: 1,
  size: 8,
  type: 'all',
};
export function parseState(params: URLSearchParams): SearchState {
  const choices = (key: string, allowed: string[], fallback = '') =>
    allowed.includes(params.get(key) ?? '') ? params.get(key)! : fallback;
  return {
    type: choices(
      'type',
      ['all', 'artwork', 'topic', 'collection', 'guide', 'tool', 'page', 'studio'],
      'all',
    ),
    q: (params.get('q') ?? '').trim().slice(0, 320),
    style: choices('style', ['color', 'outline', 'watercolor', 'black & white', 'silhouette']),
    color: choices('color', [
      'orange',
      'white',
      'purple',
      'black',
      'red',
      'yellow',
      'brown',
      'blue',
      'green',
      'pink',
      'gray',
      'multicolor',
      'beige',
      'gold',
    ]),
    format: choices('format', ['webp', 'pdf']),
    orientation: choices('orientation', ['square', 'portrait', 'landscape']),
    background: choices('background', ['transparent', 'opaque']),
    sort: choices('sort', ['relevance', 'title', 'newest'], 'relevance'),
    page: Math.min(10_000, Math.max(1, Math.floor(Number(params.get('page')) || 1))),
    size: [8, 16, 32].includes(Number(params.get('size'))) ? Number(params.get('size')) : 8,
  };
}
export function stateParams(state: SearchState): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state))
    if (value !== defaults[key as keyof SearchState] && value !== '')
      params.set(key, String(value));
  return params;
}
/** Field priorities shared by the in-memory and sharded search paths. */
export function artworkSearchFields(item: SearchArtwork) {
  const title = normalizeQuery(item.title);
  const fields: [string, number][] = [
    [item.title, 7],
    [item.topicLabel || item.topic, 6],
    [item.alt, 5],
    [
      `${item.style} ${item.color} ${item.orientation} ${(item.formats || []).join(' ')} ${item.alpha ? 'transparent cutout background' : item.alpha === false ? 'opaque background' : ''} ${item.monochrome ? 'monochrome black white' : ''}`,
      4,
    ],
    [
      item.description.split(
        /\s+(?:Add this |Use this |Choose a |Both original |Allow space |Perfect for |Ideal for )/i,
      )[0],
      3,
    ],
    [(item.keywords || []).join(' '), 3],
    [item.id.replaceAll('-', ' '), 4],
    [`${item.cluster || ''} ${(item.collections || []).join(' ')}`, 2],
  ];
  const weights = new Map<string, number>();
  for (const [text, weight] of fields)
    for (const word of normalizeQuery(text))
      weights.set(word, Math.max(weight, weights.get(word) || 0));
  return { title, weights };
}
export function artworkMatchesFilters(item: SearchArtwork, state: SearchState) {
  const intent = queryTerms(state.q);
  if (item.published === false) return false;
  if (intent.wantsMonochrome && !isMonochrome(item)) return false;
  if (
    intent.wantsOutline &&
    !(item.style.toLowerCase() === 'outline' || item.monochromeKind === 'outline')
  )
    return false;
  if (intent.wantsTransparent && item.alpha !== true) return false;
  if (state.style === 'black & white' && !isMonochrome(item)) return false;
  if (
    state.style === 'outline' &&
    !(item.style.toLowerCase() === 'outline' || item.monochromeKind === 'outline')
  )
    return false;
  if (
    state.style === 'watercolor' &&
    !normalizeQuery(`${item.style} ${item.title} ${item.alt}`).includes('watercolor')
  )
    return false;
  if (
    state.style &&
    !['black & white', 'outline', 'watercolor'].includes(state.style) &&
    item.style.toLowerCase() !== state.style
  )
    return false;
  if (state.color && item.color.toLowerCase() !== state.color) return false;
  if (state.orientation && item.orientation.toLowerCase() !== state.orientation) return false;
  if (state.format && !item.formats?.some((f) => f.toLowerCase() === state.format)) return false;
  if (state.background === 'transparent' && item.alpha !== true) return false;
  if (state.background === 'opaque' && item.alpha !== false) return false;
  return true;
}
export function searchArtwork<T extends SearchArtwork>(artwork: T[], state: SearchState) {
  const { tokens, excluded } = queryTerms(state.q),
    seen = new Set<string>();
  const exact: { item: T; score: number; fuzzy: boolean }[] = [],
    close: typeof exact = [];
  for (const item of artwork) {
    if (seen.has(item.id) || !artworkMatchesFilters(item, state)) continue;
    seen.add(item.id);
    const { title, weights } = artworkSearchFields(item);
    if (excluded.some((token) => termVariants(token).some((word) => weights.has(word)))) continue;
    const matches: TermMatch[] = [];
    for (const [index, token] of tokens.entries()) {
      const variants = termVariants(token);
      let words = variants.filter(
          (word) => weights.has(word) && (tokens.length === 1 || weights.get(word)! >= 3),
        ),
        fuzzy = false;
      if (!words.length) {
        words = [...weights.keys()].filter(
          (word) =>
            (tokens.length === 1 || weights.get(word)! >= 3) &&
            (oneEditAway(token, word) ||
              (index === tokens.length - 1 && token.length >= 3 && word.startsWith(token))),
        );
        fuzzy = !!words.length;
      }
      if (!words.length) break;
      matches.push({
        weight: Math.max(
          ...words.map((word) => (weights.get(word) || 0) - (word === token ? 0 : 0.5)),
        ),
        fuzzy,
        positions: title.flatMap((word, i) => (words.includes(word) ? [i] : [])),
      });
    }
    if (matches.length === tokens.length) {
      const fuzzy = matches.some((m) => m.fuzzy);
      (fuzzy ? close : exact).push({ item, score: relevanceScore(matches), fuzzy });
    }
  }
  const ranked = exact.length ? exact : close;
  const publicationRank =
    state.sort === 'newest'
      ? new Map(newestFirst(artwork).map((item, index) => [item.id, index]))
      : new Map<string, number>();
  ranked.sort((a, b) =>
    state.sort === 'title'
      ? a.item.title.localeCompare(b.item.title, 'en')
      : state.sort === 'newest'
        ? publicationRank.get(a.item.id)! - publicationRank.get(b.item.id)!
        : b.score - a.score || a.item.title.localeCompare(b.item.title, 'en'),
  );
  const pages = Math.max(1, Math.ceil(ranked.length / state.size)),
    page = Math.min(pages, Math.max(1, state.page));
  const selected = ranked.slice((page - 1) * state.size, page * state.size);
  return {
    items: selected.map((r) => r.item),
    total: ranked.length,
    pages,
    page,
    hasFuzzyMatches: selected.some((r) => r.fuzzy),
  };
}
