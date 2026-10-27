import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approvedArt,
  imageSitemap,
  pageSitemap,
  sitemapIndex,
  xmlEscape,
  indexableTopics,
  directoryArtwork,
  sitemapDocuments,
  partitionSitemapEntries,
} from '../src/lib/sitemaps.ts';

const example = {
  id: 'pumpkin-01',
  topic: 'pumpkin',
  webp: 'https://assets.ultraclipart.com/test/pumpkin.webp',
  published: true,
  indexable: true,
};

test('published works remain discoverable before their subject is a complete collection', () => {
  const complete = Array.from({ length: 50 }, (_, i) => ({ ...example, id: `full-${i}` }));
  const growing = { ...example, id: 'first-new-work', topic: 'new-subject' };
  const draft = { ...growing, id: 'draft', published: false };
  const noindex = { ...growing, id: 'private', indexable: false };
  const topics = [{ slug: 'pumpkin' }, { slug: 'new-subject' }];
  assert.deepEqual(directoryArtwork([...complete, growing, draft, noindex], topics), [growing]);
  const completed = Array.from({ length: 50 }, (_, i) => ({ ...growing, id: `new-${i}` }));
  assert.deepEqual(directoryArtwork([...complete, ...completed], topics), []);
});

test('growing catalogs split automatically while retaining the first sitemap URLs', () => {
  const art = Array.from({ length: 50001 }, (_, index) => ({ ...example, id: `growing-${index}` }));
  const documents = sitemapDocuments(art, []);
  assert.deepEqual(
    documents.map((document) => document.kind),
    ['pages', 'pages-2', 'images', 'images-2'],
  );
  const pages = documents.filter((document) => document.kind.startsWith('pages'));
  const images = documents.filter((document) => document.kind.startsWith('images'));
  for (const document of documents) {
    assert.ok([...document.xml.matchAll(/<url>/g)].length <= 50000);
    assert.ok(Buffer.byteLength(document.xml) <= 50 * 1024 ** 2);
  }
  assert.equal(
    images.reduce(
      (count, document) => count + [...document.xml.matchAll(/<image:image>/g)].length,
      0,
    ),
    art.length,
  );
  assert.equal(
    [
      ...pages
        .map((document) => document.xml)
        .join('')
        .matchAll(/\/art\/growing-\d+\//g),
    ].length,
    art.length,
  );
  assert.ok(sitemapIndex(art).includes('/sitemap-images-2.xml'));
});
test('sitemap splitting respects UTF-8 bytes as well as URL counts', () => {
  const entry = '<url><loc>https://ultraclipart.com/žiedas/</loc></url>';
  const overhead =
    Buffer.byteLength(partitionSitemapEntries([entry])[0]) - Buffer.byteLength(entry);
  const parts = partitionSitemapEntries(
    [entry, entry, entry],
    false,
    50000,
    overhead + Buffer.byteLength(entry) * 2,
  );
  assert.equal(parts.length, 2);
  assert.throws(() =>
    partitionSitemapEntries([entry], false, 50000, overhead + Buffer.byteLength(entry) - 1),
  );
});

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

test('new approved subjects enter HTML/XML discovery and drafts do not hide an existing subject', () => {
  const topic = { slug: 'new-subject', keyword: 'New subject clipart' };
  const items = Array.from({ length: 50 }, (_, i) => ({
    ...example,
    id: `new-${i}`,
    topic: topic.slug,
  }));
  const draft = { ...items[0], id: 'future-draft', published: false };
  assert.deepEqual(indexableTopics([...items, draft], [topic]), [topic]);
  assert.ok(pageSitemap([...items, draft], [topic]).includes('/clipart/new-subject/'));
  assert.deepEqual(indexableTopics(items.slice(0, 49), [topic]), []);
  assert.ok(!pageSitemap(items.slice(0, 49), [topic]).includes('/clipart/new-subject/'));
  assert.deepEqual(
    indexableTopics(
      items.map((item) => ({ ...item, indexable: false })),
      [topic],
    ),
    [],
  );
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
