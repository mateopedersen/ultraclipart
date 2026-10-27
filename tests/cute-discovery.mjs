import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTypescript } from './helpers/typescript.mjs';
const { cuteConfidence, buildCuteIndex, pickCute, validCuteIndex } = await loadTypescript(
  'src/lib/cute-discovery.ts',
);
const art = JSON.parse(readFileSync('data/art.json', 'utf8'));
const sample = {
  id: 'smiling-new-fruit',
  topic: 'new-fruit',
  title: 'Smiling new fruit',
  alt: 'A smiling fruit character with bright eyes, small hands and feet.',
  discovery: { cute: true },
  style: 'Color',
  published: true,
  indexable: true,
};

test('real catalog recognition includes fruit and animals, excludes monochrome and ordinary artwork', () => {
  const index = buildCuteIndex(art);
  assert.ok(index.length > 100 && index.length <= 512);
  assert.ok(index.some((x) => x.topic === 'apple'));
  assert.ok(index.some((x) => x.topic === 'rabbit'));
  for (const pick of index) {
    const source = art.find((x) => x.id === pick.id);
    assert.ok(cuteConfidence(source) >= 68);
    assert.doesNotMatch(source.style, /Black|Outline|Silhouette/);
  }
  assert.equal(
    cuteConfidence({
      ...sample,
      id: 'plain-photo',
      title: 'A red apple',
      alt: 'A plain red apple',
      discovery: undefined,
    }),
    0,
  );
  assert.ok(
    cuteConfidence({
      ...sample,
      id: 'happy-future-robot',
      topic: 'robot',
      title: 'Happy robot',
    }) > 0,
  );
});
test('decorative materials alone do not make ordinary objects cheerful subjects', () => {
  for (const [id, title, alt, topic] of [
    ['mandarin-knitted', 'Knitted mandarin', 'A mandarin made of orange yarn', 'mandarin'],
    ['apple-crochet', 'Crochet apple', 'An apple made of red yarn with a green leaf', 'apple'],
    ['pear-felt', 'Felt pear', 'A felt pear with a stitched leaf', 'pear'],
    ['phone', 'Mobile phone', 'A mobile phone with a blank screen', 'mobile-phone'],
  ]) {
    assert.equal(cuteConfidence({ ...sample, id, title, alt, topic }), 0, id);
  }
  assert.ok(
    cuteConfidence({
      ...sample,
      id: 'fox-waving',
      topic: 'fox',
      title: 'Waving fox in a knitted scarf',
      alt: 'A cheerful fox waving while wearing a knitted scarf',
    }) > 0,
  );
  assert.ok(
    cuteConfidence({
      ...sample,
      id: 'mom-baby-hug',
      topic: 'mom',
      title: 'Mother hugging her baby',
      alt: 'A mother cuddling her baby',
    }) > 0,
  );
});
test('explicit review cannot override monochrome or frightening subject exclusions', () => {
  for (const id of [
    'cute-black-and-white-rabbit',
    'baby-outline-fox',
    'smiling-skeleton',
    'cute-angry-robot',
    'not-cute-fruit',
  ])
    assert.equal(cuteConfidence({ ...sample, id, discovery: { cute: true } }), 0, id);
  assert.equal(cuteConfidence({ ...sample, discovery: { cute: false } }), 0);
  assert.equal(cuteConfidence({ ...sample, published: false }), 0);
  assert.equal(cuteConfidence({ ...sample, indexable: false }), 0);
  assert.equal(cuteConfidence({ ...sample, style: 'Black & White', discovery: { cute: true } }), 0);
  assert.equal(cuteConfidence({ ...sample, style: 'Grayscale' }), 0);
  assert.equal(
    cuteConfidence({ ...sample, alt: 'A fierce angry character', discovery: { cute: true } }),
    0,
  );
});
test('streaming reservoir stays bounded and deterministically rotates across seed versions', () => {
  function* stream() {
    for (let i = 0; i < 10000; i++)
      yield { ...sample, id: `smiling-fruit-${i}`, topic: `subject-${i % 20}` };
  }
  const a = buildCuteIndex(stream(), 64, 'release-a'),
    b = buildCuteIndex(stream(), 64, 'release-b');
  assert.equal(a.length, 64);
  assert.equal(new Set(a.map((x) => x.id)).size, 64);
  assert.deepEqual(a, buildCuteIndex(stream(), 64, 'release-a'));
  assert.notDeepEqual(a, b);
});
test('selection avoids recent IDs, the current page and consecutive subjects; sparse pools stay safe', () => {
  const pool = [
    { id: 'apple-a', topic: 'apple' },
    { id: 'apple-b', topic: 'apple' },
    { id: 'rabbit-a', topic: 'rabbit' },
    { id: 'robot-a', topic: 'robot' },
  ];
  assert.equal(pickCute(pool, ['apple-a'], 'rabbit-a', () => 0).id, 'robot-a');
  assert.equal(
    pickCute(pool, ['apple-a', 'apple-b', 'rabbit-a', 'robot-a'], 'rabbit-a', () => 0).id,
    'robot-a',
  );
  assert.equal(pickCute([], []), null);
  assert.equal(pickCute([pool[0]], [], 'apple-a'), null);
  assert.deepEqual(
    validCuteIndex([{ id: 'javascript:alert(1)', topic: 'apple' }, pool[0], pool[0]]),
    [pool[0]],
  );
  assert.deepEqual(validCuteIndex(new Array(513).fill(pool[0])), []);
});
test('topic balancing favors expressive animals without removing cheerful fruit characters', () => {
  const pool = [
    { id: 'fox-wave', topic: 'fox' },
    { id: 'apple-smile', topic: 'apple' },
  ];
  let animals = 0,
    fruit = 0;
  for (let i = 0; i < 100; i++) {
    let call = 0;
    const result = pickCute(pool, [], '', () => (call++ === 0 ? (i + 0.5) / 100 : 0));
    if (result.topic === 'fox') animals++;
    else fruit++;
  }
  assert.equal(animals, 80);
  assert.equal(fruit, 20);
});
