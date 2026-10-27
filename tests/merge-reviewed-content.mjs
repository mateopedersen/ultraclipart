import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeReviewedContent } from '../scripts/merge-reviewed-content.mjs';
const files = (id) =>
  ['webp', 'pdf', 'thumb'].map((kind) => ({ assetId: id, kind, bytes: 10, key: id + '.' + kind }));
function fixture() {
  return {
    baseline: [
      { id: 'old', topic: 'old' },
      { id: 'concurrent', topic: 'concurrent' },
    ],
    added: [{ id: 'ready', topic: 'new' }],
    currentPublication: {
      status: 'verified',
      files: [...files('old'), ...files('concurrent')],
      bytes: 60,
    },
    stagedPublication: {
      status: 'verified',
      files: [...files('old'), ...files('ready')],
      bytes: 60,
    },
    baseTopics: [{ id: 1, slug: 'old' }],
    currentExtra: [{ id: 5, slug: 'concurrent', target_original_artworks: 50 }],
    stagedExtra: [{ id: 5, slug: 'new', target_original_artworks: 50 }],
    currentCopy: { concurrent: { intro: 'Newer accepted copy' } },
    stagedCopy: { concurrent: { intro: 'Stale copy' }, new: { intro: 'Reviewed new copy' } },
    currentClusters: { concurrent: ['Latest'] },
    stagedClusters: { new: ['Reviewed'] },
  };
}
test('reviewed merge preserves concurrent records, media, copy and unique topic IDs', () => {
  const f = fixture(),
    r = mergeReviewedContent(f);
  assert.deepEqual(
    r.art.map((x) => x.id),
    ['old', 'concurrent', 'ready'],
  );
  assert.equal(r.publication.files.length, 9);
  assert.equal(r.publication.bytes, 90);
  assert.equal(r.copy.concurrent.intro, 'Newer accepted copy');
  assert.deepEqual(r.clusters.concurrent, ['Latest']);
  assert.equal(r.extra.find((x) => x.slug === 'new').id, 6);
  assert.equal(r.extra.find((x) => x.slug === 'new').target_original_artworks, 50);
  assert.equal(f.currentExtra.length, 1);
});
test('reviewed merge rejects duplicate artwork IDs and incomplete file sets', () => {
  const f = fixture();
  f.added[0].id = 'concurrent';
  assert.throws(() => mergeReviewedContent(f), /already exists/);
  const g = fixture();
  g.stagedPublication.files = g.stagedPublication.files.filter((x) => x.kind !== 'pdf');
  assert.throws(() => mergeReviewedContent(g), /Missing incoming representations/);
});
test('existing subject counts increase without replacing newer collection copy', () => {
  const f = fixture();
  f.added[0].topic = 'concurrent';
  f.stagedExtra = [{ id: 5, slug: 'concurrent', target_original_artworks: 2 }];
  const r = mergeReviewedContent(f);
  assert.equal(r.extra.length, 1);
  assert.equal(r.extra[0].target_original_artworks, 50);
  assert.equal(r.copy.concurrent.intro, 'Newer accepted copy');
});
