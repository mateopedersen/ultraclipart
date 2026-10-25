import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTypescript } from './helpers/typescript.mjs';
const { downloadPageHref } = await loadTypescript('src/lib/download-route.ts');
const art = JSON.parse(readFileSync('data/art.json'));
const publication = JSON.parse(readFileSync('data/publication.json'));
const urls = new Map(publication.files.map((file) => [`${file.assetId}/${file.kind}`, file.url]));
test('download routes bind an exact artwork and supported format; reject external and malformed input', () => {
  assert.equal(
    downloadPageHref('usb-flash-drive-example', 'webp'),
    '/download/usb-flash-drive-example/?format=webp',
  );
  for (const id of ['../art', 'a?url=https://evil.example', '//evil.example', '', 'a%2fb'])
    assert.throws(() => downloadPageHref(id, 'pdf'));
  for (const format of ['html', 'zip', 'javascript:alert(1)', '', undefined])
    assert.throws(() => downloadPageHref('apple-example', format));
});
test('every catalog download journey preserves exact original URLs, filenames, sizes and hashes', () => {
  const sitemap = readFileSync('dist/sitemap-pages.xml', 'utf8');
  assert.ok(!sitemap.includes('/download/'));
  for (const item of art) {
    const html = readFileSync(`dist/download/${item.id}/index.html`, 'utf8');
    assert.ok(html.includes(`https://ultraclipart.com/download/${item.id}/`), item.id);
    assert.match(html, /<meta name="robots" content="noindex,follow"/);
    assert.ok(html.includes(item.title.replaceAll('&', '&amp;')), item.id);
    assert.ok(html.includes('data-download-station'));
    assert.ok(html.includes('data-download-ad-region hidden'));
    assert.ok(!html.includes('adsbygoogle.js'));
    for (const format of ['webp', 'pdf']) {
      if (!item[format]) continue;
      const tag = html.match(new RegExp(`<a[^>]+download="${item.id}\\.${format}"[^>]*>`))?.[0];
      assert.ok(tag, `${item.id} ${format}`);
      assert.ok(
        tag.includes(`href="${urls.get(`${item.id}/${format}`)}"`) ||
          tag.includes(`href="${item[format]}"`),
      );
      assert.ok(tag.includes(`data-expected-bytes="${item.files[format].bytes}"`));
      assert.ok(tag.includes(`data-expected-sha256="${item.files[format].sha256}"`));
    }
  }
});
