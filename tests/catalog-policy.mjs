import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCatalogPolicy, assertCatalogPolicy } from '../scripts/seo/catalog-policy.mjs';
import { checkSourceCatalog } from '../scripts/seo/check-catalog.mjs';
import { relatedCollectionSlugs } from '../src/lib/related-collections.ts';
const rows = (topic, count = 50) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${topic}-${i + 1}`,
    topic,
    title: `Example ${topic} illustration ${i + 1}`,
    alt: `Example ${topic} subject number ${i + 1} for a test fixture.`,
    description: `A distinct description of test ${topic} illustration number ${i + 1}.`,
    published: true,
    indexable: true,
  }));
const fixture = () => ({
  artwork: [...rows('baby'), ...rows('mom')],
  topics: [{ slug: 'baby' }, { slug: 'mom' }],
  relations: { baby: ['mom'], mom: ['baby'] },
});

test('the entire current source catalog passes its production gate', () => {
  const result = checkSourceCatalog();
  assert.ok(result.artwork > 0 && result.subjects > 0);
  assert.deepEqual(result.errors, []);
});
test('new artwork in an existing subject inherits the policy without editing a template', () => {
  const input = fixture();
  input.artwork.push({
    ...rows('baby', 1)[0],
    id: 'new-baby-illustration',
    title: 'A new baby illustration',
    alt: 'A new baby scene in a test fixture.',
    description: 'A new baby composition with its own test description.',
  });
  assert.equal(assertCatalogPolicy(input).artwork, 101);
});
test('missing title, alt or description blocks publication instead of inventing image identity', () => {
  for (const field of ['alt', 'title', 'description']) {
    const input = fixture();
    input.artwork[0][field] = ' ';
    assert.throws(() => assertCatalogPolicy(input), new RegExp(`reviewed, descriptive ${field}`));
  }
});
test('a newly indexable subject needs an explicit relationship decision', () => {
  const input = fixture();
  input.topics.push({ slug: 'new-topic' });
  input.artwork.push(...rows('new-topic'));
  assert.throws(() => assertCatalogPolicy(input), /new-topic: add reviewed collection slugs/);
  input.relations['new-topic'] = [];
  assert.equal(assertCatalogPolicy(input).subjects, 3);
  assert.deepEqual(
    relatedCollectionSlugs('new-topic', input.relations, new Set(['baby', 'mom', 'new-topic'])),
    [],
  );
});
test('search URLs, unregistered slugs, self-links and duplicates cannot publish', () => {
  for (const targets of [['/search/?q=baby'], ['missing-topic'], ['baby'], ['mom', 'mom']]) {
    const input = fixture();
    input.relations.baby = targets;
    assert.throws(() => assertCatalogPolicy(input), /collection/);
  }
});
test('withdrawn destinations disappear automatically without unrelated substitutes', () => {
  const input = fixture();
  input.artwork = input.artwork.map((item) =>
    item.topic === 'mom' ? { ...item, published: false } : item,
  );
  const result = assertCatalogPolicy(input);
  assert.deepEqual(result.suppressed, [{ source: 'baby', target: 'mom' }]);
  assert.deepEqual(relatedCollectionSlugs('baby', input.relations, new Set(['baby'])), []);
});
test('draft records do not block release, but publishing them activates metadata validation', () => {
  const input = fixture();
  const draft = {
    ...rows('baby', 1)[0],
    id: 'draft-example',
    title: '',
    alt: '',
    description: 'A draft with its own reviewed test description.',
    published: false,
  };
  input.artwork.push(draft);
  assert.deepEqual(auditCatalogPolicy(input).errors, []);
  draft.published = true;
  assert.equal(auditCatalogPolicy(input).errors.length, 2);
});

test('new catalog images cannot reuse another image title, alt or description', () => {
  for (const field of ['title', 'alt', 'description']) {
    const input = fixture();
    input.artwork[1][field] = input.artwork[0][field];
    assert.throws(() => assertCatalogPolicy(input), new RegExp(`duplicate ${field}`));
  }
});
test('a replaced image or edited reviewed description requires a fresh visual review', () => {
  const input = fixture(),
    item = input.artwork[0];
  item.files = { webp: { sha256: 'a'.repeat(64) } };
  input.metadataReviews = {
    [item.id]: {
      sourceSha256: item.files.webp.sha256,
      title: item.title,
      alt: item.alt,
      description: item.description,
    },
  };
  assertCatalogPolicy(input);
  item.files.webp.sha256 = 'b'.repeat(64);
  assert.throws(() => assertCatalogPolicy(input), /renew its source-bound visual review/);
  item.files.webp.sha256 = 'a'.repeat(64);
  item.alt = 'A changed description needs to be reviewed again.';
  assert.throws(() => assertCatalogPolicy(input), /renew its source-bound visual review/);
});
