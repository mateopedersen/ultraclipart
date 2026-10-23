import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  defaults,
  normalizeQuery,
  parseState,
  searchArtwork,
  stateParams,
} from '../src/lib/search.ts';
const arts = JSON.parse(readFileSync(new URL('../data/art.json', import.meta.url)));
const topics = [
  ...JSON.parse(readFileSync(new URL('../data/topics.json', import.meta.url))).topics,
  ...JSON.parse(readFileSync(new URL('../data/extra-topics.json', import.meta.url))),
];
const fixtures = [
  {
    id: 'gift-ribbon-keepsake',
    topic: 'gift',
    title: 'Ribbon Gift',
    description: 'A ribbon gift',
    alt: 'A ribbon gift',
    style: 'Color',
    color: 'Red',
  },
  {
    id: 'gift-kraft-parcel-twine',
    topic: 'gift',
    title: 'Kraft Gift',
    description: 'A kraft gift',
    alt: 'A kraft gift',
    style: 'Color',
    color: 'Brown',
  },
  {
    id: 'pumpkin-botanical-outline',
    topic: 'pumpkin',
    title: 'Pumpkin Outline',
    description: 'Pumpkin outline',
    alt: 'Pumpkin outline',
    style: 'Outline',
    color: 'Black',
  },
  {
    id: 'spider-thread-and-bow',
    topic: 'spider',
    title: 'Spider Bow',
    description: 'Spider bow',
    alt: 'Spider bow',
    style: 'Color',
    color: 'Black',
  },
].map((item) => ({
  ...item,
  orientation: 'Square',
  formats: ['WEBP', 'PDF'],
  alpha: true,
  published: true,
  createdAt: '2026-10-23',
}));
const data = [...arts, ...fixtures].map((item) => ({
  ...item,
  cluster: topics.find((topic) => topic.slug === item.topic).cluster,
}));
const pumpkinCount = data.filter(
  (item) =>
    item.topic === 'pumpkin' ||
    ['volleyball-halloween-pumpkin-clipart', 'baby-pumpkin-costume-clipart'].includes(item.id),
).length;
const search = (patch) => searchArtwork(data, { ...defaults, ...patch });

test('query normalization handles punctuation, accents, plurals and controlled synonyms', () => {
  assert.deepEqual(normalizeQuery('  PÚMPKINS, free clipart!  '), ['pumpkin']);
  assert.deepEqual(normalizeQuery('Presents and leaves'), ['gift', 'leaf']);
  assert.equal(search({ q: 'pumpkins clipart' }).total, pumpkinCount);
  const gifts = search({ q: 'present' }).items;
  assert.ok(gifts.some((x) => x.id === 'gift-ribbon-keepsake'));
  assert.ok(gifts.some((x) => x.id === 'gift-kraft-parcel-twine'));
  assert.ok(gifts.slice(0, 2).every((x) => x.topic === 'gift'));
});
test('black-and-white queries return true outlines, not black-colored artwork', () => {
  for (const q of [
    'black and white pumpkin',
    'black-and-white pumpkin',
    'b&w pumpkin',
    'pumpkin outline',
    'pumpkin coloring page',
  ]) {
    const result = search({ q });
    assert.equal(result.total, 1, q);
    assert.equal(result.items[0].id, 'pumpkin-botanical-outline');
  }
  assert.equal(
    search({ style: 'outline', color: 'black' }).total,
    data.filter((a) => a.style === 'Outline' && a.color === 'Black').length,
  );
  assert.ok(
    search({ style: 'color', color: 'black', size: 1000 }).items.some(
      (item) => item.id === 'spider-thread-and-bow',
    ),
  );
  assert.equal(search({ q: 'outline spider' }).total, 0);
});
test('all explicit facets combine and match actual file metadata', () => {
  assert.equal(
    search({
      q: 'pumpkin',
      style: 'color',
      color: 'orange',
      format: 'pdf',
      orientation: 'square',
      background: 'transparent',
    }).total,
    data.filter(
      (x) =>
        (x.topic === 'pumpkin' ||
          ['volleyball-halloween-pumpkin-clipart', 'baby-pumpkin-costume-clipart'].includes(
            x.id,
          )) &&
        x.style === 'Color' &&
        x.color === 'Orange' &&
        x.orientation === 'Square',
    ).length,
  );
  assert.equal(
    search({ orientation: 'portrait' }).total,
    data.filter((a) => a.orientation === 'Portrait').length,
  );
  assert.equal(search({ background: 'opaque' }).total, 0);
  const withoutPdf = [{ ...data[0], formats: ['WEBP'] }];
  assert.equal(searchArtwork(withoutPdf, { ...defaults, format: 'pdf' }).total, 0);
});
test('search ranks subject matches, allows a single typo on long words and refuses short fuzzy substitutions', () => {
  const typo = search({ q: 'pumkin' });
  assert.equal(typo.total, pumpkinCount);
  assert.equal(typo.hasFuzzyMatches, true);
  assert.equal(search({ q: 'cat' }).total, 0);
  assert.equal(search({ q: 'unicorn' }).total, 0);
  assert.ok(search({ q: 'Halloween' }).total >= 2, 'topic cluster is searchable');
});
test('pagination clamps invalid pages and never duplicates result identities', () => {
  const first = search({ size: 8 });
  const last = search({ page: 999, size: 8 });
  assert.equal(first.items.length, 8);
  assert.equal(last.page, Math.ceil(data.length / 8));
  assert.equal(last.items.length, data.length % 8 || 8);
  const all = Array.from(
    { length: last.page },
    (_, i) => search({ page: i + 1, size: 8 }).items,
  ).flat();
  assert.equal(new Set(all.map((item) => item.id)).size, data.length);
  assert.equal(searchArtwork([...data, ...data], defaults).total, data.length);
});
test('sorting is deterministic and URL parameters roundtrip with validation', () => {
  const result = search({ sort: 'title', size: 16 });
  assert.deepEqual(
    result.items.map((item) => item.title),
    [...result.items.map((item) => item.title)].sort((a, b) => a.localeCompare(b, 'en')),
  );
  const state = { ...defaults, q: 'pumpkin & ghost', style: 'outline', page: 2, size: 16 };
  assert.deepEqual(parseState(stateParams(state)), state);
  const invalid = parseState(
    new URLSearchParams('page=-9&size=999&style=fake&sort=downloads&format=png'),
  );
  assert.equal(invalid.page, 1);
  assert.equal(invalid.size, 8);
  assert.equal(invalid.style, '');
  assert.equal(invalid.sort, 'relevance');
  assert.equal(invalid.format, '');
});
