/** Versioned together with the public index. No invented image labels or remote inference. */
export const SEARCH_LANGUAGE_VERSION = '9-field-phrase-intent';
const groups = [
  ['gift', 'present', 'presents', 'gifts'],
  ['leaf', 'leaves'],
  ['baby', 'babies'],
  ['snowman', 'snowmen'],
  ['cherry', 'cherries'],
  ['strawberry', 'strawberries'],
  ['raspberry', 'raspberries'],
  ['blueberry', 'blueberries'],
  ['blackberry', 'blackberries'],
  ['cranberry', 'cranberries'],
  ['mulberry', 'mulberries'],
  ['gooseberry', 'gooseberries'],
  ['peach', 'peaches'],
  ['mango', 'mangoes'],
  ['quince', 'quinces'],
  ['fig', 'figs'],
  ['starfruit', 'starfruits'],
  ['kumquat', 'kumquats'],
  ['christmas', 'xmas'],
  ['father', 'dad', 'daddy', 'papa'],
  ['mother', 'mom', 'mum', 'mommy', 'mummy', 'mama'],
  ['rabbit', 'bunny', 'bunnies'],
  ['kitten', 'kitty', 'kitties'],
  ['puppy', 'puppies'],
  ['gray', 'grey'],
  ['color', 'colour'],
  ['colorful', 'colourful'],
  ['watercolor', 'watercolour'],
  ['coloring', 'colouring'],
  ['realistic', 'photorealistic'],
  ['airplane', 'aeroplane'],
  ['cookie', 'cookies'],
  ['brownie', 'brownies'],
  ['movie', 'movies'],
  ['zombie', 'zombies'],
  ['smoothie', 'smoothies'],
  ['veggie', 'veggies'],
  ['selfie', 'selfies'],
  ['tomato', 'tomatoes'],
  ['potato', 'potatoes'],
  ['hero', 'heroes'],
  ['hold', 'holding', 'holds', 'held'],
  ['cradle', 'cradling', 'cradled'],
  ['carry', 'carrying', 'carried'],
  ['feed', 'feeding', 'fed'],
  ['sit', 'sitting', 'seated'],
  ['stand', 'standing'],
  ['sleep', 'sleeping', 'asleep'],
  ['fly', 'flying', 'flies'],
  ['run', 'running'],
  ['play', 'playing'],
  ['read', 'reading'],
  ['write', 'writing'],
  ['smile', 'smiling'],
  ['dance', 'dancing'],
  ['hug', 'hugging'],
  ['jump', 'jumping'],
  ['ride', 'riding'],
  ['swim', 'swimming'],
  ['walk', 'walking'],
  ['draw', 'drawing'],
  ['red', 'kirmizi'],
  ['blue', 'mavi'],
  ['green', 'yesil'],
  ['yellow', 'sari'],
  ['pink', 'pembe'],
  ['purple', 'mor'],
  ['orange', 'turuncu'],
  ['brown', 'kahverengi'],
  ['black', 'siyah'],
  ['white', 'beyaz'],
  ['gray', 'gri'],
  ['transparent', 'seffaf'],
  ['father', 'baba'],
  ['mother', 'anne'],
  ['baby', 'bebek'],
  ['newborn', 'yenidogan'],
  ['cat', 'kedi'],
  ['dog', 'kopek'],
  ['rabbit', 'tavsan'],
  ['fox', 'tilki'],
  ['butterfly', 'kelebek'],
  ['bird', 'kus'],
  ['flower', 'cicek'],
  ['rose', 'gul'],
  ['tree', 'agac'],
  ['leaf', 'yaprak'],
  ['heart', 'kalp'],
  ['star', 'yildiz'],
  ['pumpkin', 'balkabagi'],
  ['apple', 'elma'],
  ['strawberry', 'cilek'],
  ['lemon', 'limon'],
  ['school', 'okul'],
  ['teacher', 'ogretmen'],
  ['book', 'kitap'],
  ['pencil', 'kalem'],
  ['winter', 'kis'],
  ['summer', 'yaz'],
  ['autumn', 'fall', 'sonbahar'],
  ['snow', 'kar'],
  ['birthday', 'dogumgunu'],
  ['hold', 'tutan', 'tutuyor'],
];
const aliases = Object.fromEntries(
  groups.flatMap(([canonical, ...words]) => words.map((word) => [word, canonical])),
);
Object.assign(aliases, {
  children: 'child',
  women: 'woman',
  men: 'man',
  mice: 'mouse',
  geese: 'goose',
  teeth: 'tooth',
  feet: 'foot',
  buses: 'bus',
  news: 'news',
  canvas: 'canvas',
  processes: 'process',
});
const stopWords = new Set(
  (
    'clipart clip art free image images illustration illustrations download downloads ' +
    'the a an and of with page pages for to from on in at by his her its their is are as that this ' +
    'please find looking look need want show me my some any very picture pictures graphic graphics ' +
    'can could would you i im id like get give featuring feature about into around ' +
    'bir ve ile icin bana ariyorum istiyorum goster resmi resim gorsel gorseli olan'
  ).split(' '),
);
export function normalizeQuery(query: string): string[] {
  return query
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/[’']/g, '')
    .replace(/\bstar[\s-]+fruits?\b/g, 'starfruit')
    .replace(/\b(?:new[\s-]+born)\b/g, 'newborn')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word && !stopWords.has(word))
    .map(
      (word) =>
        aliases[word] ??
        (word.length > 4 && /(?:ches|shes|xes|zes|sses)$/.test(word)
          ? word.slice(0, -2)
          : word.length > 4 && word.endsWith('ies')
            ? word.slice(0, -3) + 'y'
            : word.length > 3 && /s$/.test(word) && !/(?:ss|us|is)$/.test(word)
              ? word.slice(0, -1)
              : word),
    );
}
export function oneEditAway(a: string, b: string): boolean {
  if (a.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const different = [...a].flatMap((c, i) => (c === b[i] ? [] : [i]));
    return (
      different.length === 1 ||
      (different.length === 2 &&
        different[1] === different[0] + 1 &&
        a[different[0]] === b[different[1]] &&
        a[different[1]] === b[different[0]])
    );
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0,
    j = 0,
    edits = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
    } else {
      j++;
      if (++edits > 1) return false;
    }
  }
  return true;
}
const relatedWording: Record<string, string[]> = {
  baby: ['infant', 'newborn'],
  hold: ['cradle', 'carry'],
  flower: ['blossom', 'bloom'],
  floral: ['flower'],
  kid: ['child', 'boy', 'girl'],
  child: ['kid', 'boy', 'girl'],
  infant: ['baby', 'newborn'],
  pair: ['two'],
  trio: ['three'],
  bouquet: ['bunch'],
};
export const termVariants = (word: string) => [word, ...(relatedWording[word] || [])];
export function queryTerms(query: string) {
  let text = query
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ı/g, 'i');
  const monochrome = /\b(?:black[\s-]*(?:and[\s-]*|&[\s-]*)?white|b\s*&\s*w|siyah\s+beyaz)\b/g;
  const outline =
    /\b(?:outline|line[\s-]*art|coloring(?:\s+pages?)?|colouring(?:\s+pages?)?|boyama)\b/g;
  const transparent =
    /\b(?:transparent(?:\s+background)?|clear\s+background|(?:without|no)\s+(?:a\s+)?background|background[\s-]*free|seffaf(?:\s+arka\s+plan)?)\b/g;
  const wantsMonochrome = monochrome.test(text) || /\b(?:coloring|colouring|boyama)\b/.test(text);
  text = text.replace(monochrome, ' ');
  const wantsOutline = outline.test(text);
  text = text.replace(outline, ' ');
  const wantsTransparent = transparent.test(text);
  text = text.replace(transparent, ' ');
  const excluded: string[] = [];
  text = text.replace(
    /\b(?:without|excluding|not|no)\s+(?:(?:a|an|any)\s+)?([a-z-]+)/g,
    (_, term) => {
      excluded.push(...normalizeQuery(term));
      return ' ';
    },
  );
  const tokens = [...new Set(normalizeQuery(text))];
  return {
    tokens,
    excluded: [...new Set(excluded)],
    wantsOutline,
    wantsMonochrome,
    wantsTransparent,
  };
}
export interface TermMatch {
  weight: number;
  fuzzy: boolean;
  positions: number[];
}
export function relevanceScore(matches: TermMatch[]) {
  let score = matches.reduce((sum, m) => sum + m.weight - (m.fuzzy ? 2 : 0), 0);
  const allTitle = matches.length > 0 && matches.every((m) => m.positions.length > 0);
  if (allTitle) score += matches.length * 5;
  let longest = 0;
  for (let first = 0; first < matches.length; first++)
    for (const position of matches[first].positions) {
      let length = 1;
      while (
        first + length < matches.length &&
        matches[first + length].positions.includes(position + length)
      )
        length++;
      longest = Math.max(longest, length);
    }
  if (longest > 1) score += longest * 8;
  return score;
}
