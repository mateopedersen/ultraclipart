import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approvedArt,
  imageSitemap,
  pageSitemap,
  sitemapIndex,
  xmlEscape,
} from '../src/lib/sitemaps.ts';

const example = {
  id: 'pumpkin-01',
  topic: 'pumpkin',
  webp: 'https://assets.ultraclipart.com/test/pumpkin.webp',
  published: true,
  indexable: true,
};

test('unapproved and noindex assets never enter the image or page sitemap', () => {
  const draft = { ...example, id: 'draft', published: false };
  const noindex = { ...example, id: 'noindex', indexable: false };
  assert.deepEqual(approvedArt([draft, noindex, example]), [example]);
  for (const xml of [
    pageSitemap([draft, noindex, example], []),
    imageSitemap([draft, noindex, example]),
  ]) {
    assert.ok(xml.includes('/art/pumpkin-01/'));
    assert.ok(!xml.includes('/art/draft/'));
    assert.ok(!xml.includes('/art/noindex/'));
  }
});

test('the pilot index excludes an empty image sitemap; approval adds a real child', () => {
  assert.ok(sitemapIndex([]).includes('/sitemap-pages.xml'));
  assert.ok(!sitemapIndex([]).includes('/sitemap-images.xml'));
  assert.throws(() => imageSitemap([]), /empty image sitemap/);
  assert.ok(sitemapIndex([example]).includes('/sitemap-images.xml'));
  assert.ok(imageSitemap([example]).includes(`<image:loc>${example.webp}</image:loc>`));
});

test('topics enter the sitemap at 50 or more approved distinct catalog items', () => {
  const collection = Array.from({ length: 50 }, (_, index) => ({
    ...example,
    id: `pumpkin-${index + 1}`,
  }));
  const topics = [{ slug: 'pumpkin' }];
  assert.ok(pageSitemap(collection, topics).includes('/clipart/pumpkin/'));
  assert.ok(
    pageSitemap([...collection, { ...example, id: 'pumpkin-extra' }], topics).includes(
      '/clipart/pumpkin/',
    ),
  );
  assert.ok(!pageSitemap(collection.slice(0, 49), topics).includes('/clipart/pumpkin/'));
  assert.ok(
    !pageSitemap(
      [...collection.slice(0, 49), { ...collection[49], indexable: false }],
      topics,
    ).includes('/clipart/pumpkin/'),
  );
});

test('XML output escapes all reserved characters and real image URL queries', () => {
  assert.equal(xmlEscape(`<&>"'`), '&lt;&amp;&gt;&quot;&apos;');
  const xml = imageSitemap([
    { ...example, webp: 'https://assets.ultraclipart.com/art.webp?a=1&b=2' },
  ]);
  assert.ok(xml.includes('art.webp?a=1&amp;b=2'));
  assert.ok(!xml.includes('art.webp?a=1&b=2'));
  assert.match(xml, /xmlns:image="http:\/\/www.google.com\/schemas\/sitemap-image\/1.1"/);
  assert.ok(!xml.includes('<lastmod>'), 'Do not fabricate modification dates');
});
