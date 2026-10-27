import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { relatedCollectionSlugs } from '../src/lib/related-collections.ts';
const json = (name) =>
  JSON.parse(readFileSync(new URL('../data/' + name, import.meta.url), 'utf8'));
const art = json('art.json').filter((item) => item.published && item.indexable);
const relations = json('topic-relations.json');
const counts = new Map();
for (const item of art) counts.set(item.topic, (counts.get(item.topic) || 0) + 1);
const eligible = new Set([...counts].filter(([, count]) => count >= 50).map(([slug]) => slug));

test('every published subject has reviewed, distinct, indexable collection destinations', () => {
  for (const source of eligible) {
    const targets = relations[source];
    assert.ok(Array.isArray(targets), source);
    assert.ok(targets.length <= 6, source);
    assert.equal(new Set(targets).size, targets.length, source);
    assert.ok(!targets.includes(source), source);
    assert.deepEqual(
      relatedCollectionSlugs(source, relations, eligible),
      targets.filter((target) => eligible.has(target)),
      source,
    );
  }
});

test('known misleading relations and search shortcuts cannot return', () => {
  assert.deepEqual(relations.baby, ['mom', 'dad', 'baby-elephant', 'heart']);
  assert.ok(relations.headphones.includes('earbuds'));
  assert.ok(!relations.headphones.includes('baby'));
  assert.ok(!relations.iphone.includes('book'));
  assert.ok(!relations.tesla.includes('iphone'));
  const template = readFileSync(
    new URL('../src/pages/clipart/[slug].astro', import.meta.url),
    'utf8',
  );
  assert.ok(!template.includes('/search/?'));
  assert.ok(!template.includes('copy?.chips'));
});

test('withdrawn, draft, duplicate, self and unknown targets never leak into navigation', () => {
  assert.deepEqual(
    relatedCollectionSlugs(
      'baby',
      { baby: ['baby', 'mom', 'mom', 'draft', 'unknown'] },
      new Set(['baby', 'mom']),
    ),
    ['mom'],
  );
  assert.deepEqual(relatedCollectionSlugs('future-topic', relations, eligible), []);
});

test('all public artwork retains non-empty, plain-text source title and alt metadata', () => {
  for (const item of art) {
    for (const key of ['title', 'alt']) {
      assert.equal(typeof item[key], 'string', `${item.id}: ${key}`);
      assert.ok(item[key].trim().length > 5, `${item.id}: ${key}`);
      assert.ok(
        !/<\/?(?:script|img|iframe)\b|\bundefined\b|\[object Object\]/i.test(item[key]),
        `${item.id}: ${key}`,
      );
    }
  }
});

test('current and future catalog preview templates bind alt and title to the same artwork', () => {
  const root = new URL('../src/', import.meta.url);
  let checked = 0;
  for (const file of readdirSync(root, { recursive: true }).filter((file) =>
    file.endsWith('.astro'),
  )) {
    const source = readFileSync(new URL(file, root), 'utf8');
    for (const [tag] of source.matchAll(/<img\b[\s\S]*?\/>/g)) {
      const object = tag.match(/src=\{([\w.\[\]]+)\.thumb\}/)?.[1];
      if (!object) continue;
      assert.ok(tag.includes(`alt={${object}.alt}`), `${file}: source-bound alt`);
      assert.ok(tag.includes(`title={${object}.title}`), `${file}: source-bound title`);
      checked++;
    }
  }
  assert.ok(checked > 20, 'Expected the shared image renderer inventory');
});
