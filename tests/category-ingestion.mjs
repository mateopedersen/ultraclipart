import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCatalogPolicy } from '../scripts/seo/catalog-policy.mjs';
import { checkSourceCatalog } from '../scripts/seo/check-catalog.mjs';
import { loadTypescript } from './helpers/typescript.mjs';
const { buildSubjectKeywords, prepareCategorySearch, scoreCategory } = await loadTypescript(
  'src/lib/category-search.ts',
);
const entry = {
  id: 'new-rabbit-with-umbrella',
  topic: 'new-rabbit',
  published: true,
  indexable: true,
  title: 'A rabbit holding a green umbrella',
  alt: 'A cheerful rabbit holding a green umbrella in the rain.',
  description: 'A small rabbit with a green umbrella and falling raindrops.',
};
const args = {
  artwork: [entry],
  topics: [{ slug: 'new-rabbit', cluster: 'Animals & nature' }],
  relations: {},
  browseGroups: ['Animals & nature', 'Food & drink'],
};
test('new registered content enters counts and search through the same source metadata', () => {
  const result = auditCatalogPolicy(args);
  assert.deepEqual(result.errors, []);
  assert.equal(result.artwork, 1);
  const subject = prepareCategorySearch({
    id: entry.topic,
    name: 'Rabbit',
    groups: args.topics[0].cluster,
    keywords: buildSubjectKeywords([entry.title, entry.alt]),
  });
  assert.ok(scoreCategory('rabbit umbrella', subject) > 0);
});
test('unknown group, unknown subject and duplicate subject cannot silently be published', () => {
  assert.ok(
    auditCatalogPolicy({
      ...args,
      topics: [{ slug: 'new-rabbit', cluster: 'Anmials' }],
    }).errors.some((x) => x.includes('registered browse group')),
  );
  assert.ok(
    auditCatalogPolicy({ ...args, artwork: [{ ...entry, topic: 'typo-subject' }] }).errors.some(
      (x) => x.includes('unregistered subject'),
    ),
  );
  assert.ok(
    auditCatalogPolicy({ ...args, topics: [...args.topics, ...args.topics] }).errors.some((x) =>
      x.includes('Duplicate subject'),
    ),
  );
});
test('current local catalog passes the same future-content safeguards', () =>
  assert.deepEqual(checkSourceCatalog().errors, []));
