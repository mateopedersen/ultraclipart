import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTypescript } from './helpers/typescript.mjs';
const { RelatedIndex, rank, CANDIDATE_LIMIT, SNAPSHOT_LIMIT } = await loadTypescript(
  'src/lib/related/engine.ts',
);
const { normalize } = await loadTypescript('src/lib/related/normalize.ts');
const catalog = JSON.parse(readFileSync('data/art.json'));
const index = new RelatedIndex(catalog);
const appleId = 'apple-and-dried-rings-crayon-clipart';
const source = catalog.find((item) => item.id === appleId);
function item(id, overrides = {}) {
  return {
    ...source,
    id,
    title: 'Apple Crayon',
    alt: 'Whole apple fruit with dried rings, wax crayon drawing.',
    files: Object.fromEntries(
      ['webp', 'thumb', 'pdf'].map((kind) => [kind, { bytes: 100, sha256: id + kind }]),
    ),
    ...overrides,
  };
}
function ids(result) {
  return [...result.alternatives, ...result.companions].map((c) => c.id);
}
test('T01 / ten real topics: eligibility and group boundaries hold across the catalog', () => {
  for (const topic of [
    'apple',
    'strawberry',
    'kiwi',
    'orange',
    'banana',
    'cat',
    'dog',
    'baby-elephant',
    'headphones',
    'volleyball',
    'turkey',
    'winter',
  ]) {
    const p = [...index.profiles.values()].find((p) => p.item.topic === topic && p.eligible);
    assert.ok(p, topic);
    const result = index.snapshot(p.item.id);
    assert.ok(result.alternatives.length > 0, topic);
    for (const card of result.alternatives)
      assert.equal(index.profiles.get(card.id).subject.id, p.subject.id);
    for (const card of result.companions) {
      assert.equal(index.profiles.get(card.id).subject.domain, 'food');
      assert.notEqual(index.profiles.get(card.id).subject.id, p.subject.id);
    }
  }
  for (const p of index.profiles.values())
    if (p.eligible && p.subject.domain === 'food' && p.depiction !== 'scene') {
      for (const id of ids(index.snapshot(p.item.id))) {
        const candidate = index.profiles.get(id);
        assert.equal(candidate.subject.domain, 'food');
        assert.notEqual(candidate.depiction, 'scene');
      }
    }
});
test('T02 kiwi bird and kiwifruit are distinct; bare kiwi remains uncertain', () => {
  const bird = normalize(
    item('kiwi-bird', {
      topic: 'kiwi',
      title: 'Kiwi Bird Watercolor',
      alt: 'Small brown kiwi bird with feathers.',
    }),
  );
  const fruit = normalize(
    item('kiwi-fruit', {
      topic: 'kiwi-fruit',
      title: 'Kiwi Fruit Watercolor',
      alt: 'Sliced kiwifruit with black seeds.',
    }),
  );
  assert.notEqual(bird.subject.id, fruit.subject.id);
  assert.equal(rank(bird, fruit), undefined);
  assert.equal(
    normalize(item('unknown-kiwi', { topic: 'unknown', title: 'Kiwi', alt: '' })).status,
    'unclassified',
  );
});
test('T03 apple is not a substring match for pineapple or Apple technology', () => {
  assert.equal(
    normalize(
      item('pineapple', {
        topic: 'pineapple',
        title: 'Pineapple Crayon',
        alt: 'Whole pineapple fruit.',
      }),
    ).subject.id,
    'food.fruit.pineapple',
  );
  assert.equal(
    normalize(
      item('wrong-apple', {
        topic: 'apple',
        title: 'Pineapple Crayon',
        alt: 'Whole pineapple fruit.',
      }),
    ).eligible,
    false,
  );
  assert.equal(
    normalize(
      item('apple-computer', { title: 'Apple Logo', alt: 'Apple logo on a MacBook computer.' }),
    ).eligible,
    false,
  );
});
test('T04 orange is not interpreted as a fruit from a color tag', () => {
  const p = normalize(
    item('orange-cat', {
      topic: 'cat',
      title: 'Orange Cat',
      alt: 'An orange cat resting.',
      color: 'Orange',
    }),
  );
  assert.equal(p.subject.id, 'animal.mammal.cat');
  assert.equal(p.secondary.includes('food.fruit.orange'), false);
});
test('T05 dried fruit rings and jewelry rings do not share a subject', () => {
  const jewelry = normalize(
    item('jewelry-ring', {
      topic: 'ring',
      title: 'Wedding Ring Crayon',
      alt: 'A golden wedding ring.',
    }),
  );
  assert.equal(jewelry.subject.id, 'object.jewelry.ring');
  assert.equal(rank(index.profiles.get(appleId), jewelry), undefined);
});
test('T06 bat, baseball bat, Turkey country and baby elephant contexts are separate', () => {
  const animal = normalize(
    item('animal-bat', { topic: 'bat', title: 'Bat Watercolor', alt: 'A bat with folded wings.' }),
  );
  const sport = normalize(
    item('baseball-bat', {
      topic: 'baseball-bat',
      title: 'Baseball Bat Watercolor',
      alt: 'A wooden baseball bat.',
    }),
  );
  assert.notEqual(animal.subject.id, sport.subject.id);
  assert.equal(
    normalize(
      item('turkey-map', {
        topic: 'turkey',
        title: 'Turkey Map',
        alt: 'Map of the country Turkey.',
      }),
    ).eligible,
    false,
  );
  const elephant = normalize(
    item('young-elephant', {
      topic: 'baby-elephant',
      title: 'Baby Elephant Watercolor',
      alt: 'An elephant calf.',
    }),
  );
  assert.equal(elephant.subject.id, 'animal.mammal.elephant.young');
  assert.ok(!elephant.secondary.includes('people.person.baby'));
  assert.equal(
    normalize(
      item('young-camel', {
        topic: 'camel',
        title: 'Baby Camel Calf Watercolor',
        alt: 'A small camel calf.',
      }),
    ).eligible,
    true,
  );
});
test('T07 self, exact duplicate bytes and canonical format copies are excluded', () => {
  const duplicate = { ...source, id: 'duplicate-source' };
  const canonicalA = item('canonical-a', { canonicalArtworkId: 'master' }),
    canonicalB = item('canonical-b', { canonicalArtworkId: 'master' });
  const local = new RelatedIndex([source, duplicate, canonicalA, canonicalB]);
  assert.ok(!ids(local.snapshot(appleId)).includes('duplicate-source'));
  assert.ok(!ids(local.snapshot(appleId)).includes(appleId));
  assert.ok(!ids(local.snapshot('canonical-a')).includes('canonical-b'));
});
test('T08 natural fruit outranks a faced character without calling a face a human', () => {
  const plain = normalize(item('natural-apple')),
    character = normalize(
      item('happy-apple', {
        title: 'Smiling Apple Cartoon',
        alt: 'An apple character with a simple smiling face.',
      }),
    );
  assert.equal(character.subject.domain, 'food');
  assert.equal(character.depiction, 'character');
  assert.ok(
    rank(index.profiles.get(appleId), plain).tier <
      rank(index.profiles.get(appleId), character).tier,
  );
});
test('T09 animal holding a fruit cannot leak into natural fruit recommendations', () => {
  const mixed = normalize(
    item('apple-with-monkey', { title: 'Apple With Monkey', alt: 'A monkey holding an apple.' }),
  );
  assert.equal(mixed.depiction, 'scene');
  assert.equal(rank(index.profiles.get(appleId), mixed), undefined);
});
test('T10 reference companion is genuinely present and never appears in More apples', () => {
  const snapshot = index.snapshot(appleId);
  assert.ok(snapshot.companions.some((c) => c.id === 'dried-orange-slices-crayon-clipart'));
  const subject = index.getRelatedArtwork(appleId, { mode: 'subject', limit: 40 });
  assert.equal(subject.companions.length, 0);
  assert.ok(
    subject.alternatives.every((c) => index.profiles.get(c.id).subject.id === 'food.fruit.apple'),
  );
});
test('T11 monochrome filter uses actual color mode; its label is not a technique', () => {
  const result = index.getRelatedArtwork(appleId, { mode: 'monochrome', limit: 40 });
  assert.ok(result.alternatives.length >= 3);
  assert.ok(result.alternatives.every((c) => c.monochrome));
  assert.equal(
    normalize(item('just-color', { title: 'Apple', alt: 'An apple fruit.', style: 'Color' }))
      .technique,
    undefined,
  );
});
test('T12 sparse subjects do not get random filler', () => {
  const local = new RelatedIndex([source, catalog.find((a) => a.topic === 'cat')]);
  assert.deepEqual(ids(local.snapshot(appleId)), []);
});
test('T13 missing, conflicting, revoked, broken and unavailable metadata narrows safely', () => {
  for (const override of [
    { published: false },
    { indexable: false },
    { recommendationEligible: false },
    { thumb: '' },
    { webp: 'javascript:alert(1)' },
    { files: {} },
    { licenseStatus: 'REVOKED' },
    { reviewStatus: 'FAILED' },
    { title: 'Cat Painting', alt: 'A cat.' },
    { title: '', alt: '' },
  ]) {
    assert.equal(normalize(item('invalid', override)).eligible, false, JSON.stringify(override));
  }
});
test('T14 a new unknown subject stays unclassified instead of forcing a fruit match', () => {
  assert.equal(
    normalize(
      item('mystery', {
        topic: 'new-subject',
        title: 'Zorbith Spiral',
        alt: 'A zorbith spiral object.',
      }),
    ).status,
    'unclassified',
  );
  for (const title of [
    'Lime Fitness Watch with Towel and Bottle',
    'Pink Cat Face Watch with Charms',
    'Travel Laptop with Suitcase and Headphones',
    'Unknown Device with Apple Decoration',
  ]) {
    const profile = normalize(
      item('new-device', { topic: 'new-device-family', title, alt: title }),
    );
    assert.equal(profile.status, 'unclassified', title);
    assert.equal(profile.subject, undefined, title);
    assert.equal(profile.eligible, false, title);
    assert.ok(profile.issues.includes('unknown_catalog_topic'));
  }
  assert.equal(
    normalize(item('missing-topic', { topic: undefined, title: 'Apple Crayon' })).subject.id,
    'food.fruit.apple',
  );
});
test('T15 remove/unpublish immediately invalidates snapshots; stale jobs cannot resurrect a record', () => {
  const candidate = item('candidate'),
    local = new RelatedIndex([source, candidate]);
  const before = local.snapshot(appleId);
  assert.ok(ids(before).includes('candidate'));
  assert.equal(local.remove('candidate', 2), true);
  assert.ok(!ids(local.snapshot(appleId)).includes('candidate'));
  assert.notEqual(local.version, before.version);
  assert.equal(local.upsert(candidate), false);
  assert.equal(local.upsert({ ...candidate, revision: 2 }), false);
  const second = item('candidate-two');
  local.upsert(second);
  local.upsert({ ...second, published: false, revision: 2 });
  assert.ok(!ids(local.snapshot(appleId)).includes(second.id));
});
test('T16 new eligible artwork joins its indexed subject on ingestion', () => {
  const local = new RelatedIndex([source]);
  local.upsert(item('new-apple'));
  assert.ok(ids(local.snapshot(appleId)).includes('new-apple'));
});
test('T17 stale expected revisions and reviews never overwrite new metadata', () => {
  const local = new RelatedIndex([source]);
  assert.equal(local.upsert({ ...source, revision: 2 }, 1), false);
  assert.equal(local.upsert({ ...source, revision: 2 }), true);
  assert.equal(local.upsert(source), false);
  const p = normalize(
    item('reviewed', {
      revision: 2,
      semanticReview: {
        revision: 1,
        subjectId: 'animal.mammal.cat',
        reviewer: 'test',
        evidence: 'old',
      },
    }),
  );
  assert.equal(p.subject.id, 'food.fruit.apple');
  assert.ok(p.issues.includes('stale_or_invalid_review'));
});
test('T18 idempotent repeated normalization creates neither duplicates nor version drift', () => {
  const local = new RelatedIndex([source, item('candidate')]),
    version = local.version;
  assert.equal(local.upsert(item('candidate')), true);
  assert.equal(local.version, version);
  assert.equal(local.profiles.size, 2);
});
test('T19 cursor is scoped to source, filter and version; pagination never duplicates', () => {
  let cursor,
    collected = [];
  do {
    const page = index.getRelatedArtwork(appleId, { mode: 'subject', cursor, limit: 5 });
    collected.push(...ids(page));
    cursor = page.cursor;
  } while (cursor);
  assert.equal(collected.length, new Set(collected).size);
  const first = index.getRelatedArtwork(appleId, { mode: 'subject', limit: 1 });
  assert.throws(() =>
    index.getRelatedArtwork(appleId, { mode: 'companions', cursor: first.cursor }),
  );
  assert.throws(() => index.getRelatedArtwork(appleId, { cursor: 'bad' }));
  assert.throws(() => index.getRelatedArtwork(appleId, { mode: 'all-random' }));
  assert.throws(() => index.getRelatedArtwork(appleId, { limit: 1000000 }));
  const local = new RelatedIndex([source, item('one'), item('two')]);
  const page = local.getRelatedArtwork(appleId, { limit: 1 });
  local.upsert(item('three'));
  assert.throws(() => local.getRelatedArtwork(appleId, { cursor: page.cursor }));
});
test('T25 stable ranking is independent of ingestion input order and requests', () => {
  const small = catalog.filter((a) => ['apple', 'orange'].includes(a.topic));
  assert.deepEqual(
    new RelatedIndex(small).snapshot(appleId),
    new RelatedIndex([...small].reverse()).snapshot(appleId),
  );
  assert.deepEqual(index.snapshot(appleId), index.snapshot(appleId));
});
test('T26 popularity cannot override semantic eligibility', () => {
  const popular = normalize(
    item('popular-cat', {
      topic: 'cat',
      title: 'Cat Crayon',
      alt: 'A cat.',
      views: Number.MAX_SAFE_INTEGER,
    }),
  );
  assert.equal(rank(index.profiles.get(appleId), popular), undefined);
  assert.equal(rank(index.profiles.get(appleId), popular, true), undefined);
});
test('T27 missing evidence adds zero, never a renormalized perfect match', () => {
  const minimal = normalize(
    item('minimal', { title: 'Apple', alt: 'An apple fruit.', style: '', color: '' }),
  );
  const complete = normalize(item('complete'));
  assert.ok(
    rank(index.profiles.get(appleId), minimal).score <
      rank(index.profiles.get(appleId), complete).score,
  );
});
test('T28 50,000-record dense subject retains bounded candidate and transfer limits', () => {
  const dense = Array.from({ length: 50000 }, (_, i) => item(`dense-${i}`));
  const local = new RelatedIndex([source, ...dense]);
  const snapshot = local.snapshot(appleId);
  assert.ok(snapshot.examined <= CANDIDATE_LIMIT);
  assert.ok(ids(snapshot).length <= SNAPSHOT_LIMIT);
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) < 64000);
  local.upsert(item('fresh-entry', { createdAt: '2026-11-01T00:00:00Z' }));
  assert.ok(ids(local.snapshot(appleId)).includes('fresh-entry'));
});
test('labeled relevance set: exact fruit reference, cross-subject errors and companions', () => {
  const labels = [
    ['apple-and-slice-fan-pastel-clipart', 'alternative'],
    ['apple-and-wedge-watercolor-clipart', 'alternative'],
    ['dried-orange-slices-crayon-clipart', 'companion'],
    [catalog.find((a) => a.topic === 'cat').id, 'reject'],
    [catalog.find((a) => a.topic === 'strawberry').id, 'reject'],
    [catalog.find((a) => a.topic === 'kiwi').id, 'reject'],
    [catalog.find((a) => a.topic === 'headphones').id, 'reject'],
    [catalog.find((a) => a.topic === 'volleyball').id, 'reject'],
    [catalog.find((a) => a.topic === 'baby').id, 'reject'],
  ];
  for (const [id, expected] of labels) {
    const target = index.profiles.get(id);
    assert.ok(target, id);
    const actual = rank(index.profiles.get(appleId), target)
      ? 'alternative'
      : rank(index.profiles.get(appleId), target, true)
        ? 'companion'
        : 'reject';
    assert.equal(actual, expected, id);
  }
});
test('T29 device collections have safe same-subject alternatives', () => {
  for (const topic of ['keyboard', 'laptop', 'printer', 'scanner']) {
    const records = catalog.filter((artwork) => artwork.topic === topic);
    assert.ok(records.length >= 2, `${topic} collection should contain multiple artworks`);
    const safeRecords = records.filter((artwork) => index.profiles.get(artwork.id)?.eligible);
    assert.ok(safeRecords.length >= 2, `${topic} should have multiple safe alternatives`);
    for (const artwork of safeRecords) {
      const profile = index.profiles.get(artwork.id);
      assert.equal(profile.subject.topic, topic, artwork.id);
    }
    const result = index.snapshot(safeRecords[0].id);
    assert.ok(result.alternatives.length > 0, topic);
    assert.ok(
      result.alternatives.every(
        (candidate) => index.profiles.get(candidate.id).subject.topic === topic,
      ),
      topic,
    );
  }
});
test('a musical keyboard stays a secondary mention rather than a computer subject', () => {
  const vampire = normalize(
    item('vampire-organ-keyboard', {
      topic: 'vampire',
      title: 'Vampire at a Musical Organ',
      alt: 'A vampire plays a small organ keyboard.',
    }),
  );
  assert.equal(vampire.subject.topic, 'vampire');
});
