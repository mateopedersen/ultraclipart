import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pageGraph, ORGANIZATION_ID, WEBSITE_ID } from '../src/lib/page-seo.ts';
import { buildSiteIcons } from '../scripts/build-site-icons.mjs';

test('website, publisher and page use one stable organization identity', () => {
  const data = pageGraph({
    canonical: 'https://ultraclipart.com/clipart/baby/',
    title: 'Baby Clipart',
    description: 'Baby artwork.',
    primaryImage: '/catalog/baby.webp',
  });
  assert.deepEqual(
    data['@graph'].map((node) => node['@type']),
    ['Organization', 'WebSite', 'WebPage'],
  );
  assert.equal(data['@graph'][0]['@id'], ORGANIZATION_ID);
  assert.equal(data['@graph'][1]['@id'], WEBSITE_ID);
  assert.equal(data['@graph'][2].publisher['@id'], ORGANIZATION_ID);
  assert.equal(data['@graph'][2].primaryImageOfPage, 'https://ultraclipart.com/catalog/baby.webp');
  assert.ok(!JSON.stringify(data).includes('Person'));
});
test('private pages do not claim a public WebPage or expose a project', () => {
  const data = pageGraph({
    canonical: 'https://ultraclipart.com/favorites/',
    title: 'Favorites',
    description: 'Saved artwork.',
    noindex: true,
  });
  assert.deepEqual(
    data['@graph'].map((node) => node['@type']),
    ['Organization', 'WebSite'],
  );
  for (const canonical of [
    'https://other.test/',
    'http://ultraclipart.com/',
    'https://ultraclipart.com/?q=private',
    'https://ultraclipart.com/#project',
  ])
    assert.throws(() => pageGraph({ canonical, title: 'Example', description: 'Example' }));
});
test('square favicon files decode correctly, preserve the source and rebuild identically', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ultraclipart-icons-'));
  try {
    mkdirSync(join(root, 'public'));
    const logo = readFileSync(new URL('../public/logo.svg', import.meta.url));
    writeFileSync(join(root, 'public/logo.svg'), logo);
    const first = await buildSiteIcons(root),
      second = await buildSiteIcons(root);
    assert.deepEqual(first, second);
    assert.deepEqual(readFileSync(join(root, 'public/logo.svg')), logo);
    for (const [file, size] of [
      ['favicon-96.png', 96],
      ['favicon-192.png', 192],
      ['apple-touch-icon.png', 180],
    ]) {
      const info = await sharp(join(root, 'public', file)).metadata();
      assert.equal(info.format, 'png');
      assert.equal(info.width, size);
      assert.equal(info.height, size);
    }
    const ico = readFileSync(join(root, 'public/favicon.ico'));
    assert.equal(ico.readUInt16LE(2), 1);
    assert.equal(ico.readUInt16LE(4), 3);
    for (let index = 0; index < 3; index++) {
      const entry = 6 + index * 16,
        length = ico.readUInt32LE(entry + 8),
        offset = ico.readUInt32LE(entry + 12);
      const info = await sharp(ico.subarray(offset, offset + length)).metadata();
      assert.equal(info.width, [16, 32, 48][index]);
      assert.equal(info.height, info.width);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
