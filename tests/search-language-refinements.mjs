import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypescript } from './helpers/typescript.mjs';
const { normalizeQuery, queryTerms } = await loadTypescript('src/lib/search-language.ts');
test('aliases apply after plural normalization', () =>
  assert.deepEqual(normalizeQuery('aeroplanes bunnies strawberries'), [
    'airplane',
    'rabbit',
    'strawberry',
  ]));
test('line drawing requests preserve subject and activate the correct outline facet', () => {
  const q = queryTerms('elephant line drawings');
  assert.deepEqual(q.tokens, ['elephant']);
  assert.equal(q.wantsOutline, true);
});
