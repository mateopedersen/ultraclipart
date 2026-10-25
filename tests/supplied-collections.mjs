import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { defaults, parseState, searchArtwork } from '../src/lib/search.ts';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const art = JSON.parse(read('data/art.json'));
for (const topic of ['baby', 'heart']) {
  test(`${topic}: fifty verified pairs preserve their originals and editor dimensions`, () => {
    const items = art.filter((a) => a.topic === topic);
    const proof = JSON.parse(read(`data/${topic}-preflight.json`));
    assert.equal(items.length, 50);
    assert.equal(proof.status, 'PASS');
    assert.equal(new Set(items.map((a) => a.alt)).size, 50);
    for (const a of items) {
      const checked = proof.rows.find((r) => r.id === a.id);
      assert.equal(a.sourceType, 'raster');
      assert.equal(a.svg, null);
      assert.equal(checked.pairedWebp, a.id);
      assert.equal(a.files.pdf.sha256, checked.sha256);
      assert.equal(a.files.webp.sha256, checked.webpSha256);
      assert.ok(a.files.pdf.bytes <= 1_000_000);
      assert.equal(a.width, checked.images[0].width);
      assert.equal(a.height, checked.images[0].height);
      for (const kind of ['pdf', 'webp', 'thumb']) {
        const bytes = readFileSync(new URL('../public' + a[kind], import.meta.url));
        assert.equal(createHash('sha256').update(bytes).digest('hex'), a.files[kind].sha256);
      }
    }
    const matches = searchArtwork(art, { ...defaults, q: topic, size: 1000 }).items;
    for (const a of items)
      assert.ok(
        matches.some((m) => m.id === a.id),
        a.id,
      );
  });
  test(
    `${topic}: collection and every detail have canonical SEO, downloads and editing`,
    { skip: !existsSync(new URL(`../dist/clipart/${topic}/index.html`, import.meta.url)) },
    () => {
      const html = read(`dist/clipart/${topic}/index.html`);
      assert.match(html, /CollectionPage/);
      assert.match(html, /"numberOfItems":50/);
      assert.doesNotMatch(html, /content="noindex/);
      assert.ok(html.includes(`https://ultraclipart.com/clipart/${topic}/`));
      for (const a of art.filter((a) => a.topic === topic)) {
        const detail = read(`dist/art/${a.id}/index.html`);
        assert.ok(html.includes(`/art/${a.id}/`));
        assert.ok(html.includes(`/edit/${a.id}/`));
        assert.ok(detail.includes(`href="/download/${a.id}/?format=pdf"`));
        assert.ok(detail.includes(`href="/download/${a.id}/?format=webp"`));
        assert.match(detail, /ImageObject/);
        assert.ok(detail.includes(`https://ultraclipart.com/art/${a.id}/`));
        assert.ok(existsSync(new URL(`../dist/edit/${a.id}/index.html`, import.meta.url)));
      }
    },
  );
}
test('new portrait and gray facets survive URL parsing; babies matches baby', () => {
  assert.equal(parseState(new URLSearchParams('color=gray&orientation=portrait')).color, 'gray');
  const result = searchArtwork(art, { ...defaults, q: 'babies', size: 1000 });
  for (const a of art.filter((a) => a.topic === 'baby'))
    assert.ok(result.items.some((m) => m.id === a.id));
});
test('owner-supplied heart coverage does not inflate generated artwork counts', () => {
  const queue = JSON.parse(read('data/production-queue.json'));
  const topics = new Set(JSON.parse(read('data/topics.json')).topics.map((t) => t.slug));
  assert.equal(topics.size, 110);
  assert.equal(
    queue.generatedArtworkCount,
    art.filter((a) => topics.has(a.topic) && a.productionMethod !== 'owner-supplied').length,
  );
  assert.equal(
    queue.remainingToDraw,
    5500 - art.filter((a) => topics.has(a.topic) && a.productionMethod !== 'owner-supplied').length,
  );
  assert.equal(queue.topics.find((t) => t.topic === 'heart').supplied, 50);
});
