import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assetsRobotsPlan } from '../scripts/seo/prepare-assets-robots.mjs';
import { imageSitemap, pageSitemap, sitemapIndex } from '../src/lib/sitemaps.ts';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const body = read('config/assets/robots.txt');
test('the indexable cookie policy is discoverable without adding private or filtered pages', () => {
  const xml = pageSitemap([], []);
  assert.ok(xml.includes('https://ultraclipart.com/cookies/'));
  assert.ok(xml.includes('https://ultraclipart.com/library-index/'));
  for (const path of ['search/', 'favorites/', 'share/', 'edit/'])
    assert.ok(!xml.includes(`https://ultraclipart.com/${path}`));
});
test('CDN robots is a separate root text object with a revalidatable cache', () => {
  const plan = assetsRobotsPlan(body);
  assert.equal(plan.targetUrl, 'https://assets.ultraclipart.com/robots.txt');
  assert.equal(plan.objectKey, 'robots.txt');
  assert.equal(plan.contentType, 'text/plain; charset=utf-8');
  assert.equal(plan.cacheControl, 'public, max-age=300, must-revalidate');
  assert.equal(plan.bytes, Buffer.byteLength(body));
  assert.equal(plan.mode, 'local-preparation-only');
});
test('crawler blocking, invented indexing directives and foreign sitemaps fail closed', () => {
  for (const invalid of [
    body + 'Index: /\n',
    body + 'Noindex: /\n',
    body + 'Disallow: /\n',
    body + 'User-agent: Googlebot-Image\nDisallow: /\n',
    body.replace('Sitemap: https://ultraclipart.com/', 'Sitemap: https://example.com/'),
    '\uFEFF' + body,
  ])
    assert.throws(() => assetsRobotsPlan(invalid));
});
test('the readable directory and machine-readable maps form one discovery chain', () => {
  const plan = assetsRobotsPlan(body);
  assert.equal(plan.discovery.directory, 'https://ultraclipart.com/library-index/');
  assert.ok(body.includes(`Sitemap: ${plan.discovery.sitemapIndex}`));
  assert.ok(
    sitemapIndex([
      { id: 'example', topic: 'example', webp: '/example.webp', published: true, indexable: true },
    ]).includes(plan.discovery.images),
  );
  assert.ok(pageSitemap([], []).includes(plan.discovery.directory));
  assert.ok(
    !body
      .split('\n')
      .some((line) => line.startsWith('Sitemap:') && line.includes('/library-index/')),
  );
});
test('every approved current artwork has exactly one verified CDN original in the image sitemap', () => {
  const art = JSON.parse(read('data/art.json'));
  const files = JSON.parse(read('data/publication.json')).files;
  const originals = new Map(files.filter((f) => f.kind === 'webp').map((f) => [f.assetId, f]));
  const published = art.filter((a) => a.published && a.indexable);
  const deployed = published.map((item) => {
    const original = originals.get(item.id);
    assert.ok(original, `Missing publication URL: ${item.id}`);
    assert.equal(new URL(original.url).origin, 'https://assets.ultraclipart.com');
    assert.equal(original.contentType, 'image/webp');
    return { ...item, webp: original.url };
  });
  const xml = imageSitemap(deployed);
  const images = [...xml.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((m) => m[1]);
  assert.equal(images.length, published.length);
  assert.equal(new Set(images).size, published.length);
  assert.ok(sitemapIndex(deployed).includes('https://ultraclipart.com/sitemap-images.xml'));
  assert.ok(!xml.includes('/edit/'));
  assert.ok(!xml.includes('/search/'));
});
