import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertPublishedImage } from './support/published-page.mjs';
const item = JSON.parse(readFileSync('data/art.json'))[0];
const published = JSON.parse(readFileSync('data/publication.json')).files.find(
  (file) => file.assetId === item.id && file.kind === 'webp',
).url;
test('published image checks bind the displayed file and schema to the selected build mode', () => {
  const previous = process.env.CF_PAGES;
  try {
    for (const [mode, source] of [
      ['0', item.webp],
      ['1', published],
    ]) {
      process.env.CF_PAGES = mode;
      const schema = `"contentUrl":"${new URL(source, 'https://ultraclipart.com').href}"`;
      const preview = (src) => `<figure id="art-preview"><img src="${src}"></figure>`;
      assert.doesNotThrow(() => assertPublishedImage(item, `${preview(source)}${schema}`));
      assert.throws(() =>
        assertPublishedImage(item, `${preview('/wrong.webp')}${schema} assets.ultraclipart.com`),
      );
      assert.throws(() =>
        assertPublishedImage(item, `${preview(source)}"contentUrl":"https://wrong.example/"`),
      );
    }
  } finally {
    if (previous === undefined) delete process.env.CF_PAGES;
    else process.env.CF_PAGES = previous;
  }
});
