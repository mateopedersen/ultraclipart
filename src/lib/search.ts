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
  cluster?: string;
  published?: boolean;
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
};
const aliases: Record<string, string> = {
  leaves: 'leaf',
  snowmen: 'snowman',
  presents: 'gift',
  present: 'gift',
  gifts: 'gift',
  xmas: 'christmas',
};
const stopWords = new Set([
  'clipart',
  'clip',
  'art',
  'free',
  'image',
  'images',
  'illustration',
  'illustrations',
  'download',
  'downloads',
  'the',
  'a',
  'an',
  'and',
  'of',
  'with',
  'page',
  'pages',
]);
export function normalizeQuery(query: string): string[] {
  return query
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token && !stopWords.has(token))
    .map(
      (token) =>
        aliases[token] ??
        (token.length > 4 && token.endsWith('s') && !token.endsWith('ss')
          ? token.slice(0, -1)
          : token),
    );
}
export function parseState(params: URLSearchParams): SearchState {
  const choices = (key: string, allowed: string[], fallback = '') =>
    allowed.includes(params.get(key) ?? '') ? params.get(key)! : fallback;
  return {
    q: (params.get('q') ?? '').trim().slice(0, 160),
    style: choices('style', ['color', 'outline']),
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
export function oneEditAway(a: string, b: string): boolean {
  if (a.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + (i < a.length || j < b.length ? 1 : 0) <= 1;
}
export function queryTerms(query: string) {
  const outlinePhrase =
    /\b(?:black[\s-]*(?:and[\s-]*|&[\s-]*)?white|b\s*&\s*w|outline|coloring(?:\s+pages?)?)\b/gi;
  const wantsOutline = outlinePhrase.test(query);
  const tokens = normalizeQuery(query.replace(outlinePhrase, ' '));
  return { wantsOutline, tokens };
}
export function searchArtwork<T extends SearchArtwork>(artwork: T[], state: SearchState) {
  const { wantsOutline, tokens } = queryTerms(state.q);
  const seen = new Set<string>();
  const ranked: { item: T; score: number; fuzzy: boolean }[] = [];
  for (const item of artwork) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const outline = item.style.toLowerCase() === 'outline';
    if ((wantsOutline && !outline) || (state.style && item.style.toLowerCase() !== state.style))
      continue;
    if (state.color && item.color.toLowerCase() !== state.color) continue;
    if (state.orientation && item.orientation.toLowerCase() !== state.orientation) continue;
    if (state.format && !item.formats?.some((format) => format.toLowerCase() === state.format))
      continue;
    if (state.background === 'transparent' && item.alpha !== true) continue;
    if (state.background === 'opaque' && item.alpha !== false) continue;
    const strong = normalizeQuery(`${item.topic} ${item.title}`);
    const all = normalizeQuery(
      `${item.topic} ${item.title} ${item.description} ${item.alt} ${item.cluster ?? ''}`,
    );
    let score = 0;
    let fuzzy = false;
    let matched = true;
    for (const token of tokens) {
      if (strong.includes(token)) score += 5;
      else if (all.includes(token)) score += 2;
      else if (all.some((word) => oneEditAway(token, word))) {
        score += 1;
        fuzzy = true;
      } else {
        matched = false;
        break;
      }
    }
    if (matched) ranked.push({ item, score, fuzzy });
  }
  ranked.sort((a, b) =>
    state.sort === 'title'
      ? a.item.title.localeCompare(b.item.title, 'en')
      : state.sort === 'newest'
        ? (b.item.createdAt ?? '').localeCompare(a.item.createdAt ?? '') ||
          a.item.title.localeCompare(b.item.title, 'en')
        : b.score - a.score || a.item.title.localeCompare(b.item.title, 'en'),
  );
  const pages = Math.max(1, Math.ceil(ranked.length / state.size));
  const page = Math.min(pages, Math.max(1, state.page));
  const selected = ranked.slice((page - 1) * state.size, page * state.size);
  return {
    items: selected.map((result) => result.item),
    total: ranked.length,
    pages,
    page,
    hasFuzzyMatches: selected.some((result) => result.fuzzy),
  };
}
