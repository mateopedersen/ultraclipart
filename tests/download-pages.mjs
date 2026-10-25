import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { loadTypescript } from './helpers/typescript.mjs';
import { readPublishedPage } from './support/published-page.mjs';
const { verifiedSourceUrl } = await loadTypescript('src/editor/source-policy.ts');
const art = JSON.parse(readFileSync('data/art.json'));
const publication = JSON.parse(readFileSync('data/publication.json'));
const urls = new Map(publication.files.map((file) => [`${file.assetId}/${file.kind}`, file.url]));
test('inline downloads accept verified originals and reject external or malformed selections', () => {
  const file = { url: '/catalog/apple-example.webp', bytes: 123, sha256: 'a'.repeat(64) };
  assert.equal(verifiedSourceUrl(file, 'webp', 'https://ultraclipart.com').pathname, file.url);
  for (const url of [
    'https://evil.example/a.webp',
    '/catalog/../art.webp',
    '/catalog/a.webp?url=evil',
    '/catalog/a%2fb.webp',
    'javascript:alert(1)',
  ])
    assert.throws(() => verifiedSourceUrl({ ...file, url }, 'webp', 'https://ultraclipart.com'));
  for (const bytes of [0, -1, 16_000_001, NaN])
    assert.throws(() => verifiedSourceUrl({ ...file, bytes }, 'webp', 'https://ultraclipart.com'));
});
test('every inline catalog journey preserves exact original URLs, filenames, sizes and hashes without download HTML pages', () => {
  assert.ok(!existsSync('dist/download'));
  assert.ok(!readFileSync('dist/sitemap-pages.xml', 'utf8').includes('/download/'));
  assert.match(readFileSync('dist/_redirects', 'utf8'), /\/download\/\* \/art\/:splat 301/);
  const manifest = JSON.parse(readFileSync('dist/search-data/manifest.json'));
  const records = new Map(
    readdirSync(`dist/search-data/${manifest.version}/items`)
      .flatMap((name) =>
        JSON.parse(readFileSync(`dist/search-data/${manifest.version}/items/${name}`)),
      )
      .map((item) => [item.id, item]),
  );
  for (const item of art) {
    const html = readPublishedPage(item, 'art');
    assert.ok(html.includes(`https://ultraclipart.com/art/${item.id}/`), item.id);
    assert.ok(html.includes('id="download-panel-template"'));
    assert.ok(html.includes('data-download-record'));
    assert.ok(!html.includes('href="/download/'));
    assert.ok(!html.includes('adsbygoogle.js'));
    const record = records.get(item.id);
    assert.equal(record.download.width, item.width);
    assert.equal(record.download.height, item.height);
    for (const format of ['webp', 'pdf']) {
      if (!item[format]) continue;
      const tag = html.match(new RegExp(`<a[^>]+download="${item.id}\\.${format}"[^>]*>`))?.[0];
      assert.ok(tag, `${item.id} ${format}`);
      assert.ok(tag.includes(`data-download-open="${item.id}"`));
      assert.ok(tag.includes(`data-download-format="${format}"`));
      assert.ok(
        tag.includes(`href="${urls.get(`${item.id}/${format}`)}"`) ||
          tag.includes(`href="${item[format]}"`),
      );
      assert.equal(record.download.files[format].bytes, item.files[format].bytes);
      assert.equal(record.download.files[format].sha256, item.files[format].sha256);
      assert.ok([urls.get(`${item.id}/${format}`), item[format]].includes(record[format]));
    }
  }
});
