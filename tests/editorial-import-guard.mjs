import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewedImportCatalog } from '../scripts/reviewed-imports.mjs';
import {
  collectionSourceSignature,
  requiredCollectionIntroductions,
  readRequiredCollectionIntroductions,
} from '../scripts/collection-editorial.mjs';
const read = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const catalog = read('data/art.json'),
  ledger = read('data/editorial/legacy-baseline.json');
const reviews = read('data/editorial/reviews.json');

test('the finite legacy ledger is unchanged and never approves incoming image IDs', () => {
  const bytes = readFileSync(new URL('../data/editorial/legacy-baseline.json', import.meta.url));
  const proof = read('data/editorial/legacy-baseline-provenance.json');
  assert.equal(Object.keys(ledger.records).length, 13004);
  assert.equal(proof.records, 13004);
  assert.equal(proof.allowNewIds, false);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    '8a913cb086b2cc44883d7cdb235228ce13dfe5fa579bcb69a7dca40889795089',
  );
  for (const item of catalog.filter(
    (x) => x.sourceCollection === 'owner-tesla-commerce-550-2026-10-27',
  ))
    assert(!ledger.records[item.id]);
  assert.equal(reviewedImportCatalog(catalog, reviews).length, catalog.length);
});

test('new images in any future collection and changed legacy copy need source-bound reviews', () => {
  const old = catalog.find((x) => ledger.records[x.id]);
  assert.equal(reviewedImportCatalog([old], { schema: 1, artworks: [] }).length, 1);
  assert.throws(
    () =>
      reviewedImportCatalog(
        [{ ...old, id: 'future-unreviewed-artwork', sourceCollection: 'a-new-collection' }],
        { schema: 1, artworks: [] },
      ),
    /review required/i,
  );
  assert.throws(
    () =>
      reviewedImportCatalog([{ ...old, description: old.description + ' Changed text.' }], {
        schema: 1,
        artworks: [],
      }),
    /review required/i,
  );
});

test('future subjects need an inventory-bound short introduction and replacements invalidate it', () => {
  const fixture = { ...catalog[0], id: 'future-subject-example', topic: 'future-subject' };
  assert.throws(
    () => requiredCollectionIntroductions([fixture], { schema: 1, topics: {} }),
    /missing or stale/,
  );
  const record = {
    status: 'checked-against-catalog',
    sourceSha256: collectionSourceSignature([fixture]),
    intro: 'A white volleyball with curved panels.',
    checkedAt: '2026-10-27T00:00:00Z',
    evidence: [{ id: fixture.id, imageSha256: fixture.files.webp.sha256 }],
  };
  const registry = { schema: 1, topics: { 'future-subject': record } };
  assert.equal(
    requiredCollectionIntroductions([fixture], registry).get('future-subject'),
    record.intro,
  );
  assert.throws(
    () =>
      requiredCollectionIntroductions(
        [{ ...fixture, title: fixture.title + ' Changed' }],
        registry,
      ),
    /missing or stale/,
  );
  assert(readRequiredCollectionIntroductions(catalog).size >= 13);
});
