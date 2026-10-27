import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  readCollectionAudit,
  validateCollectionCopy,
  verifyCollectionEditorial,
} from '../scripts/collection-editorial.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const catalog = read('data/art.json');
const registry = read('data/editorial/collections.json');

test('every published subject has its own concise introduction tied to the actual catalog', () => {
  const report = readCollectionAudit(root.pathname);
  const expected = new Set(
    catalog.filter((item) => item.published && item.indexable).map((item) => item.topic),
  ).size;
  assert.equal(report.topics, expected);
  assert.equal(report.uniqueIntroductions, expected);
  assert.match(registry.topics.sunflower.intro, /seed studies/);
  assert.doesNotMatch(registry.topics.sunflower.intro, /CMYK|WebP|Every design includes/);
});

test('new topics, changed pictures, duplicated prose and stale example IDs cannot bypass curation', () => {
  const items = catalog.filter((item) => item.topic === 'sunflower');
  const record = registry.topics.sunflower;
  assert.throws(() => validateCollectionCopy('sunflower', items, undefined), /missing or stale/);
  const replaced = structuredClone(items);
  replaced[0].files.webp.sha256 = 'a'.repeat(64);
  assert.throws(() => validateCollectionCopy('sunflower', replaced, record), /missing or stale/);
  assert.throws(
    () =>
      validateCollectionCopy('sunflower', items, {
        ...record,
        evidence: [
          { id: 'not-published', imageSha256: 'a'.repeat(64) },
          ...record.evidence.slice(1),
        ],
      }),
    /invalid or replaced/,
  );
  assert.throws(
    () =>
      validateCollectionCopy('sunflower', items, {
        ...record,
        intro: 'Every design includes a transparent WebP and matching CMYK PDF.',
      }),
    /technical filler/,
  );
  const duplicate = structuredClone(registry);
  duplicate.topics.sunflower.intro = duplicate.topics.wheat.intro;
  assert.throws(() => verifyCollectionEditorial(catalog, duplicate), /Repeated collection/);
});

test(
  'all built subject pages render the short summary and matching schema without the removed essays',
  { skip: !existsSync(new URL('dist/clipart/sunflower/index.html', root)) },
  () => {
    for (const [topic, record] of Object.entries(registry.topics)) {
      const html = readFileSync(new URL(`dist/clipart/${topic}/index.html`, root), 'utf8');
      const schema = [
        ...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
      ]
        .map((match) => JSON.parse(match[1]))
        .find((entry) => entry['@type'] === 'CollectionPage');
      const published = catalog.filter(
        (item) => item.topic === topic && item.published && item.indexable,
      );
      if (published.length >= 50) {
        assert.ok(schema, `Missing collection schema: ${topic}`);
        assert.equal(schema.description, record.intro, topic);
      } else {
        assert.equal(schema, undefined, `Incomplete collection must not expose schema: ${topic}`);
        assert.match(html, /<meta name="robots" content="noindex/, topic);
      }
      assert(html.includes('data-collection-summary'), topic);
      assert.doesNotMatch(
        html,
        /Keep the transparent WebP over|From screen to paper|Find a sunflower image with the right purpose and shape/,
      );
      assert.doesNotMatch(html, /https?:\/\/(?:127\.0\.0\.1|localhost)/);
      assert(html.includes('aria-label="Artwork help"'), topic);
    }
  },
);
