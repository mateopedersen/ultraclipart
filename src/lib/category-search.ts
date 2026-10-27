import { normalizeQuery, oneEditAway, queryTerms, termVariants } from './search-language';

export interface CategorySearchItem {
  id: string;
  name: string;
  groups: string;
  keywords: string;
}
const framing = new Set(
  'artwork design printable png jpg jpeg webp svg pdf cutout collection category subject create make project craft card invitation sticker decoration'.split(
    ' ',
  ),
);
const synonyms: Record<string, string[]> = {
  feline: ['cat'],
  canine: ['dog'],
  kitten: ['cat'],
  puppy: ['dog'],
  floral: ['flower'],
  flower: ['flower', 'floral', 'rose', 'sunflower', 'tulip', 'daisy', 'orchid'],
  infant: ['baby'],
  newborn: ['baby'],
  toddler: ['baby', 'boy', 'girl'],
  kid: ['boy', 'girl', 'baby'],
  child: ['boy', 'girl', 'baby'],
  classroom: ['school', 'book', 'pencil', 'teacher'],
  worksheet: ['school', 'book', 'pencil'],
  birthday: ['birthday', 'balloon', 'cake', 'gift', 'party'],
  wedding: ['wedding', 'heart', 'rose', 'flower'],
  valentine: ['valentine', 'heart', 'rose'],
  ocean: ['ocean', 'sea', 'dolphin', 'whale', 'shark', 'octopus', 'fish', 'crab'],
  sea: ['sea', 'ocean', 'dolphin', 'whale', 'shark', 'octopus', 'fish', 'crab'],
  farm: ['farm', 'cow', 'horse', 'pig', 'sheep', 'goat', 'chicken'],
};
const usefulWords = (text: string) =>
  normalizeQuery(normalizeQuery(text).join(' ')).filter((word) => !framing.has(word));
export function buildSubjectKeywords(titles: string[]): string {
  // Generated from current artwork titles at build time, including new imports.
  // Store each term once instead of shipping the complete catalog to the browser.
  return [...new Set(titles.flatMap(usefulWords))].sort().join(' ');
}
export function prepareCategorySearch(item: CategorySearchItem) {
  const name = usefulWords(item.name);
  const weights = new Map<string, number>();
  for (const [text, weight] of [
    [item.name, 12],
    [item.id, 10],
    [item.groups, 4],
    [item.keywords, 2],
  ] as const)
    for (const word of usefulWords(text))
      weights.set(word, Math.max(weight, weights.get(word) ?? 0));
  return { item, name, weights };
}
export type PreparedCategory = ReturnType<typeof prepareCategorySearch>;
export function scoreCategory(query: string, record: PreparedCategory): number {
  const intent = queryTerms(query);
  const terms = usefulWords(intent.tokens.join(' '));
  if (!terms.length) return intent.tokens.length ? 0 : 1;
  if (intent.excluded.some((word) => record.name.includes(word))) return 0;
  let score = 0;
  for (const term of terms) {
    const variants = [...new Set([...termVariants(term), ...(synonyms[term] ?? [])])];
    let match = 0;
    for (const variant of variants) {
      const exact = record.weights.get(variant) ?? 0;
      match = Math.max(match, exact * (variant === term ? 10 : 7));
      if (variant.length >= 3)
        for (const [word, weight] of record.weights) {
          if (word.startsWith(variant)) match = Math.max(match, weight * 5);
          else if (variant.length >= 4 && oneEditAway(variant, word))
            match = Math.max(match, weight * 3);
        }
    }
    if (!match) return 0; // Never silently discard a meaningful long-tail word.
    score += match;
  }
  if (terms.join(' ') === record.name.join(' ')) score += 300;
  if (record.name.join(' ').includes(terms.join(' '))) score += 150;
  return score;
}
