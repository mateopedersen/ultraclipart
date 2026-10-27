import { normalizeQuery, queryTerms, termVariants } from './search-language.ts';
import { searchKindLabels, type SiteSearchEntry } from './site-search.ts';
import type { SearchCard } from './search-index.ts';

export interface SearchSuggestion {
  title: string;
  href: string;
  kind: string;
  thumb?: string;
  thumbSrcSet?: string;
  alt?: string;
}

/** Promote deliberate subject/tool navigation, not incidental matches in page copy. */
export function isDirectSearchMatch(entry: SiteSearchEntry, query: string) {
  const plan = queryTerms(query);
  const words = [...plan.tokens];
  if (plan.wantsOutline) words.push('outline');
  if (plan.wantsMonochrome) words.push('black', 'white');
  if (plan.wantsTransparent) words.push('transparent');
  const title = normalizeQuery(entry.title);
  return (
    words.length > 0 &&
    words.every((word) => termVariants(word).some((term) => title.includes(term)))
  );
}

export function searchSuggestions(
  query: string,
  artwork: SearchCard[],
  matches: { entry: SiteSearchEntry; fuzzy: boolean }[],
): SearchSuggestion[] {
  const direct = matches.filter((match) => !match.fuzzy && isDirectSearchMatch(match.entry, query));
  const toSuggestion = ({ entry }: { entry: SiteSearchEntry }): SearchSuggestion => ({
    title: entry.title,
    href: entry.href,
    kind: searchKindLabels[entry.kind],
  });
  const candidates = [
    ...direct.slice(0, 2).map(toSuggestion),
    ...artwork.slice(0, 4).map((item) => ({
      title: item.title,
      href: `/art/${item.id}/`,
      kind: 'Artwork',
      thumb: item.thumb,
      ...(item.thumbSrcSet ? { thumbSrcSet: item.thumbSrcSet } : {}),
      alt: item.alt,
    })),
    ...matches.map(toSuggestion),
  ];
  const seen = new Set<string>();
  return [
    ...candidates.filter(({ href }) => !seen.has(href) && !!seen.add(href)).slice(0, 7),
    {
      title: `See all results for “${query}”`,
      href: `/search/?q=${encodeURIComponent(query)}`,
      kind: 'Search',
    },
  ];
}
