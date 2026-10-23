import test from 'node:test';
import assert from 'node:assert/strict';
import { replacementFor, mergeGeneratedWave } from '../scripts/replacement-contract.mjs';

const prior = {
  id: 'penguin-one',
  topic: 'penguin',
  revision: 1,
  files: {
    webp: { sha256: 'old-webp' },
    pdf: { sha256: 'old-pdf' },
  },
};
const plan = { topic: 'penguin', replacementReview: 'data/artwork-replacements.json' };
const meta = { id: prior.id, replacesRevision: 1 };
const review = {
  decisions: [
    {
      replaceId: prior.id,
      topic: prior.topic,
      decision: 'REPLACE_NEAR_COMPOSITION',
      priorWebpSha256: 'old-webp',
      priorPdfSha256: 'old-pdf',
    },
  ],
};
test('a replacement is bound to both current downloads, topic and revision', () => {
  assert.equal(replacementFor(plan, meta, [prior], review), prior);
  for (const change of [
    { ...prior, revision: 2 },
    { ...prior, topic: 'wolf' },
    { ...prior, files: { ...prior.files, webp: { sha256: 'different' } } },
    { ...prior, files: { ...prior.files, pdf: { sha256: 'different' } } },
  ])
    assert.throws(() => replacementFor(plan, meta, [change], review), /stale/);
  assert.throws(() => replacementFor(plan, meta, [], review), /one reviewed/);
  assert.throws(
    () =>
      replacementFor(plan, meta, [prior], {
        decisions: [...review.decisions, ...review.decisions],
      }),
    /one reviewed/,
  );
});
test('replacement keeps existing positions and counts; new art appends without overwriting', () => {
  const untouched = { id: 'penguin-two' },
    replacement = { ...prior, revision: 2 };
  assert.deepEqual(mergeGeneratedWave([prior, untouched], [replacement], true), [
    replacement,
    untouched,
  ]);
  assert.throws(() => mergeGeneratedWave([prior], [replacement], false), /collision/);
  assert.throws(() => mergeGeneratedWave([prior], [untouched], true), /missing/);
  assert.throws(() => mergeGeneratedWave([prior], [replacement, replacement], true), /Duplicate/);
  assert.deepEqual(mergeGeneratedWave([prior], [untouched], false), [prior, untouched]);
});
