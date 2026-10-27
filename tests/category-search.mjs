import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTypescript } from './helpers/typescript.mjs';
const { buildSubjectKeywords, prepareCategorySearch, scoreCategory } = await loadTypescript(
  'src/lib/category-search.ts',
);
const art = JSON.parse(readFileSync('data/art.json')).filter((x) => x.published && x.indexable);
const topics = [
  ...JSON.parse(readFileSync('data/topics.json')).topics,
  ...JSON.parse(readFileSync('data/extra-topics.json')),
];
const records = topics.map((t) =>
  prepareCategorySearch({
    id: t.slug,
    name: t.keyword,
    groups: t.cluster,
    keywords: buildSubjectKeywords(
      art.filter((x) => x.topic === t.slug).map((x) => `${x.title} ${x.alt} ${x.style}`),
    ),
  }),
);
const search = (q) =>
  records
    .map((r) => ({ id: r.item.id, score: scoreCategory(q, r) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
for (const [query, expected] of [
  ['sunflower', 'sunflower'],
  ['sunflwer', 'sunflower'],
  ['bunnies', 'rabbit'],
  ['aeroplanes', 'airplane'],
  ['babies', 'baby'],
  ['mum', 'mom'],
  ['please find baby elephant clipart for me', 'baby-elephant'],
  ['transparent sunflower clipart', 'sunflower'],
  ['ＰＵＭＰＫＩＮ', 'pumpkin'],
  ['tilki', 'fox'],
  ['strawberries', 'strawberry'],
  ['birthday card', 'happy-birthday'],
])
  test(`Ranks the intended subject first: ${query}`, () =>
    assert.equal(search(query)[0]?.id, expected, JSON.stringify(search(query).slice(0, 5))));
test('Specific queries do not fall back to unrelated broad topics', () => {
  assert.equal(search('zz-no-such-subject').length, 0);
  assert.equal(search('sunflower elephant submarine').length, 0);
  assert.equal(search('baby elephant')[0].id, 'baby-elephant');
  assert.ok(!search('baby elephant').some((x) => x.id === 'air-conditioner'));
});
test('New artwork wording becomes searchable without adding a hand-written topic alias', () => {
  const record = prepareCategorySearch({
    id: 'future-subject',
    name: 'Future Subject',
    groups: 'New ideas',
    keywords: buildSubjectKeywords(['Laughing marmot with a red umbrella']),
  });
  assert.ok(scoreCategory('laughing marmot umbrella', record) > 0);
  assert.equal(scoreCategory('laughing marmot bicycle', record), 0);
});
test('Long-tail descriptions, use cases and exclusions narrow the candidate set', () => {
  assert.ok(search('smiling rabbit watercolor').some((x) => x.id === 'rabbit'));
  assert.ok(search('classroom worksheet').some((x) => x.id === 'school'));
  assert.ok(search('ocean animals').some((x) => x.id === 'dolphin'));
  assert.ok(!search('animals without cats').some((x) => x.id === 'cat'));
});
