import {
  normalizeQuery,
  oneEditAway,
  queryTerms,
  termVariants,
  relevanceScore,
  type TermMatch,
} from './search-language.ts';
export type SiteSearchKind = 'topic' | 'collection' | 'guide' | 'tool' | 'page' | 'studio';
export interface SiteSearchEntry {
  id: string;
  kind: SiteSearchKind;
  title: string;
  description: string;
  href: string;
  text: string;
}
export const searchKindLabels: Record<string, string> = {
  all: 'All Results',
  artwork: 'Artwork',
  topic: 'Subjects',
  collection: 'Collections',
  guide: 'Guides',
  tool: 'Tools',
  page: 'Site Pages',
  studio: 'Studio Elements',
};
export function searchSiteEntries(entries: SiteSearchEntry[], query: string, kind = 'all') {
  const plan = queryTerms(query),
    tokens = [...plan.tokens];
  if (plan.wantsOutline) tokens.push('outline');
  if (plan.wantsMonochrome) tokens.push('black', 'white');
  if (plan.wantsTransparent) tokens.push('transparent');
  const candidates = entries.filter((entry) => kind === 'all' || entry.kind === kind);
  const exact: { entry: SiteSearchEntry; score: number; fuzzy: boolean }[] = [],
    close: typeof exact = [];
  for (const entry of candidates) {
    const title = normalizeQuery(entry.title),
      body = new Set(
        normalizeQuery(
          `${entry.title} ${entry.description} ${entry.text} ${searchKindLabels[entry.kind]}`,
        ),
      );
    if (plan.excluded.some((word) => termVariants(word).some((term) => body.has(term)))) continue;
    const matches: TermMatch[] = [];
    for (const [i, token] of tokens.entries()) {
      let words = termVariants(token).filter((word) => body.has(word)),
        fuzzy = false;
      if (!words.length) {
        words = [...body].filter(
          (word) =>
            oneEditAway(token, word) ||
            (i === tokens.length - 1 && token.length >= 3 && word.startsWith(token)),
        );
        fuzzy = !!words.length;
      }
      if (!words.length) break;
      const positions = title.flatMap((word, i) => (words.includes(word) ? [i] : []));
      matches.push({ weight: positions.length ? 7 : 2, positions, fuzzy });
    }
    if (matches.length !== tokens.length) continue;
    const fuzzy = matches.some((m) => m.fuzzy),
      score =
        relevanceScore(matches) +
        (tokens.length === title.length && matches.every((m) => m.positions.length) ? 12 : 0);
    (fuzzy ? close : exact).push({ entry, score, fuzzy });
  }
  return (exact.length ? exact : close).sort(
    (a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'en'),
  );
}
