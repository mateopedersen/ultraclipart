import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPublishedPage, assertPublishedImage } from './support/published-page.mjs';

test('a source-bound detail preview passes, but a different displayed image cannot hide in metadata', () => {
  const item = JSON.parse(readFileSync(new URL('../data/art.json', import.meta.url), 'utf8')).find(
    (item) => item.published && item.indexable,
  );
  const html = readPublishedPage(item, 'art');
  assertPublishedImage(item, html);
  const start = html.indexOf('id="art-preview"');
  assert.ok(start > 0);
  const wrong =
    html.slice(0, start) +
    html
      .slice(start)
      .replace(/(<img\b[^>]*\bsrc=")[^"]+"/, '$1/previews/p1/ffffffffffffffffffffffff-960.webp"');
  assert.notEqual(wrong, html);
  assert.throws(() => assertPublishedImage(item, wrong), /Wrong displayed image/);
});
