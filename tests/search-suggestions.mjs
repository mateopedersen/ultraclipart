import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSuggestions, isDirectSearchMatch } from '../src/lib/search-suggestions.ts';
import { queryTerms } from '../src/lib/search-language.ts';
import { defaults, searchArtwork } from '../src/lib/search.ts';
import { readFileSync } from 'node:fs';
const topic = {
  id: 'pumpkin',
  kind: 'topic',
  title: 'Pumpkin Clipart',
  href: '/pumpkin/',
  description: '',
  text: '',
};
const art = {
  id: 'baby-pumpkin-costume-clipart',
  title: 'Baby Pumpkin Costume',
  thumb: '/thumb.webp',
};
test('direct subjects precede artwork, without duplicate destinations', () => {
  const results = searchSuggestions('pumpkins', [art], [{ entry: topic, fuzzy: false }]);
  assert.equal(results[0].href, '/pumpkin/');
  assert.equal(results[1].href, `/art/${art.id}/`);
  assert.equal(new Set(results.map((x) => x.href)).size, results.length);
});
test('detailed scene and style queries never promote a broad subject', () => {
  for (const query of [
    'baby pumpkin costume',
    'outline pumpkin',
    'transparent pumpkin',
    'black and white pumpkin',
  ])
    assert.equal(isDirectSearchMatch(topic, query), false, query);
  const results = searchSuggestions(
    'baby pumpkin costume',
    [art],
    [{ entry: topic, fuzzy: false }],
  );
  assert.equal(results[0].href, `/art/${art.id}/`);
});
test('fallback destination safely preserves the entire query', () => {
  const query = 'red fox & baby + "snow"';
  const results = searchSuggestions(query, [], []);
  assert.equal(new URL(results[0].href, 'https://ultraclipart.com').searchParams.get('q'), query);
});
test('request framing does not dilute long-tail scene constraints', () => {
  for (const query of [
    'I am searching for a red cardinal with holly',
    'Please could you help me find a red cardinal with holly',
    'Do you have a red cardinal with holly',
  ])
    assert.deepEqual(queryTerms(query).tokens, ['red', 'cardinal', 'holly']);
  assert.deepEqual(queryTerms('children help teachers').tokens, ['child', 'help', 'teacher']);
  assert.deepEqual(queryTerms('I am looking for a red fox without a scarf').excluded, ['scarf']);
});
test('long-tail catalog queries retrieve the intended reviewed artwork', () => {
  const catalog = JSON.parse(readFileSync(new URL('../data/art.json', import.meta.url)));
  for (const [q, id] of [
    ['I am searching for a red cardinal with holly', 'winter-red-cardinal-holly'],
    ['Could you help me find an arctic fox resting', 'winter-arctic-fox-resting'],
    ['father holding newborn baby', 'dad-clipart-father-newborn-cradle'],
    ['baby pumpkin costume', 'baby-pumpkin-costume-clipart'],
  ])
    assert.equal(searchArtwork(catalog, { ...defaults, q }).items[0]?.id, id, q);
  assert.equal(searchArtwork(catalog, { ...defaults, q: 'red cardinal holly submarine' }).total, 0);
});
