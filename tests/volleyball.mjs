import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { defaults, searchArtwork, parseState, stateParams } from '../src/lib/search.ts';
import { buildSearchIndex } from '../src/lib/search-index.ts';
import { SearchRepository } from '../src/lib/search-remote.ts';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const art = JSON.parse(read('data/art.json'));
const volleyball = art.filter((a) => a.topic === 'volleyball');
test('50 supplied pairs retain their inspected original bytes and CMYK profile evidence', () => {
  const proof = JSON.parse(read('data/volleyball-preflight.json'));
  assert.equal(volleyball.length, 50);
  assert.equal(proof.rows.length, 50);
  assert.equal(new Set(volleyball.map((a) => a.alt)).size, 50);
  for (const a of volleyball) {
    const row = proof.rows.find((r) => r.id === a.id);
    assert.equal(row.status, 'PASS');
    assert.equal(row.pairedWebp, a.id);
    for (const kind of ['webp', 'pdf']) assert.equal(a.files[kind].sha256, row.sha256[kind]);
    assert.equal(a.sourceType, 'raster');
    assert.equal(a.svg, null);
    assert.deepEqual(Object.keys(a.files).sort(), ['pdf', 'thumb', 'webp']);
    assert.ok(row.images.every((i) => i.components === 4 && i.iccBytes > 128));
    assert.equal(a.width, 1382);
    assert.equal(a.height, 1382);
  }
});
test('volleyball searches include every design and distinguish monochrome, outlines and watercolor', async () => {
  const data = art.map((a) => ({ ...a, editable: true }));
  const build = buildSearchIndex(
    data,
    [{ slug: 'volleyball', keyword: 'Volleyball clipart' }],
    'volleyball-test',
  );
  const remote = new SearchRepository(async (path) =>
    structuredClone(build.files.get(path.replace(/^\/search-data\//, '').replace(/\.json$/, ''))),
  );
  for (const patch of [
    { q: 'volleyball' },
    { q: 'black and white volleyball' },
    { q: 'volleyball outline' },
    { q: 'volleyball', style: 'watercolor' },
    { q: 'volleyball', style: 'black & white' },
  ]) {
    const state = { ...defaults, ...patch, size: 32 };
    assert.deepEqual(parseState(stateParams(state)), state);
    const result = searchArtwork(data, state),
      loaded = await remote.search(state);
    assert.equal(loaded.total, result.total);
    assert.deepEqual(
      loaded.items.map((a) => a.id),
      result.items.map((a) => a.id),
    );
    assert.ok(loaded.items.every((a) => a.editable !== false));
  }
  assert.equal(searchArtwork(data, { ...defaults, q: 'volleyball' }).total, 50);
  assert.equal(searchArtwork(data, { ...defaults, q: 'black and white volleyball' }).total, 10);
  assert.equal(searchArtwork(data, { ...defaults, q: 'volleyball outline' }).total, 3);
});
test(
  'volleyball pages expose real downloads and image SEO with image editing and accurate image SEO',
  { skip: !existsSync(new URL('../dist/clipart/volleyball/index.html', import.meta.url)) },
  () => {
    const topic = read('dist/clipart/volleyball/index.html');
    assert.equal((topic.match(/class="art-card"/g) || []).length, 50);
    assert.match(topic, /"@type":"CollectionPage"/);
    assert.match(topic, /"numberOfItems":50/);
    assert.doesNotMatch(topic, /<meta name="robots" content="noindex/);
    const sitemap = read('dist/sitemap-pages.xml'),
      images = read('dist/sitemap-images.xml');
    assert.ok(sitemap.includes('https://ultraclipart.com/clipart/volleyball/'));
    for (const a of volleyball) {
      const html = read(`dist/art/${a.id}/index.html`);
      assert.ok(html.includes(`download="${a.id}.webp"`));
      assert.ok(html.includes(`download="${a.id}.pdf"`));
      assert.match(html, /"@type":"ImageObject"/);
      assert.match(html, /ICC-based CMYK/);
      assert.ok(images.includes(`/art/${a.id}/`));
      assert.doesNotMatch(html, /named layers|Editable layered vector/);
      assert.equal(existsSync(new URL(`../dist/edit/${a.id}/index.html`, import.meta.url)), true);
    }
  },
);
