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
const topics = JSON.parse(readFileSync(new URL('../data/topics.json', import.meta.url))).topics;
const data = arts.map((item) => ({
  ...item,
  cluster: topics.find((topic) => topic.slug === item.topic).cluster,
}));
const search = (patch) => searchArtwork(data, { ...defaults, ...patch });

test('query normalization handles punctuation, accents, plurals and controlled synonyms', () => {
  assert.deepEqual(normalizeQuery('  PÚMPKINS, free clipart!  '), ['pumpkin']);
  assert.deepEqual(normalizeQuery('Presents and leaves'), ['gift', 'leaf']);
  assert.equal(search({ q: 'pumpkins clipart' }).total, 2);
  assert.equal(search({ q: 'present' }).items[0].id, 'gift-ribbon-keepsake');
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
  assert.equal(search({ style: 'outline', color: 'black' }).total, 1);
  assert.equal(search({ style: 'color', color: 'black' }).items[0].id, 'spider-thread-and-bow');
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
    1,
  );
  assert.equal(search({ orientation: 'portrait' }).total, 0);
  assert.equal(search({ background: 'opaque' }).total, 0);
  const withoutPdf = [{ ...data[0], formats: ['WEBP'] }];
  assert.equal(searchArtwork(withoutPdf, { ...defaults, format: 'pdf' }).total, 0);
});
test('search ranks subject matches, allows a single typo on long words and refuses short fuzzy substitutions', () => {
  const typo = search({ q: 'pumkin' });
  assert.equal(typo.total, 2);
  assert.equal(typo.hasFuzzyMatches, true);
  assert.equal(search({ q: 'cat' }).total, 0);
  assert.equal(search({ q: 'unicorn' }).total, 0);
  assert.ok(search({ q: 'Halloween' }).total >= 4, 'topic cluster is searchable');
});
test('pagination clamps invalid pages and never duplicates result identities', () => {
  const first = search({ size: 8 });
  const last = search({ page: 999, size: 8 });
  assert.equal(first.items.length, 8);
  assert.equal(last.page, 2);
  assert.equal(last.items.length, 2);
  assert.equal(new Set([...first.items, ...last.items].map((item) => item.id)).size, data.length);
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
