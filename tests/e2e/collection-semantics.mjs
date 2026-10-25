import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.BASE_URL || 'http://127.0.0.1:4349';
const topic = process.env.TOPIC;
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic ?? '')) throw Error('TOPIC is required');
const expectedRevision = process.env.EXPECTED_REVISION;
if (process.env.RELEASE_DATA_DIR && !/^[0-9a-f]{40}$/.test(expectedRevision ?? ''))
  throw Error('Release snapshot requires its exact revision');
const read = (name) =>
  JSON.parse(
    readFileSync(
      process.env.RELEASE_DATA_DIR
        ? resolve(process.env.RELEASE_DATA_DIR, name)
        : new URL('../../data/' + name, import.meta.url),
      'utf8',
    ),
  );
const rows = read('art.json').filter((a) => a.topic === topic);
const copy = read('collection-copy.json')[topic];
const expectedCount = Number(process.env.EXPECTED_ARTWORK_COUNT || 50);
assert.ok(Number.isSafeInteger(expectedCount) && expectedCount > 0);
assert.equal(rows.length, expectedCount);
const out = resolve(process.env.EVIDENCE_DIR || 'reports/' + topic + '-semantics');
mkdirSync(out, { recursive: true });
const report = {
  base,
  topic,
  expectedRevision: expectedRevision ?? null,
  checkedArtwork: 0,
  collection: false,
  sitemaps: false,
  status: 'running',
  errors: [],
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_BIN ? { executablePath: process.env.BROWSER_BIN } : {}),
});
const page = await browser.newPage();
page.on('pageerror', (error) => report.errors.push(error.message));
const schema = async () =>
  page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((nodes) => nodes.flatMap((n) => JSON.parse(n.textContent || '{}')));
async function assertHead(path, description) {
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://ultraclipart.com' + path,
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', description);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    'content',
    description,
  );
  if (expectedRevision)
    await expect(page.locator('meta[name="build-revision"]')).toHaveAttribute(
      'content',
      expectedRevision,
    );
  assert.equal(await page.locator('html').getAttribute('lang'), 'en-US');
}
try {
  await page.goto(base + '/clipart/' + topic + '/', { waitUntil: 'domcontentloaded' });
  await assertHead('/clipart/' + topic + '/', copy.description);
  assert.equal(await page.locator('h1').count(), 1);
  await expect(page.locator('.hero > p')).toHaveText(copy.intro);
  const collection = (await schema()).find((s) => s['@type'] === 'CollectionPage');
  assert.equal(collection.mainEntity.numberOfItems, expectedCount);
  assert.deepEqual(
    new Set(collection.mainEntity.itemListElement.map((a) => a.url)),
    new Set(rows.map((a) => 'https://ultraclipart.com/art/' + a.id + '/')),
  );
  report.collection = true;
  for (const artwork of rows) {
    await page.goto(base + '/art/' + artwork.id + '/', { waitUntil: 'domcontentloaded' });
    await assertHead('/art/' + artwork.id + '/', artwork.description);
    await expect(page.locator('h1')).toHaveText(artwork.title);
    await expect(page.locator('#art-preview img')).toHaveAttribute('alt', artwork.alt);
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      'content',
      artwork.alt,
    );
    const image = (await schema()).find((s) => s['@type'] === 'ImageObject');
    assert.equal(image.name, artwork.title);
    assert.equal(image.description, artwork.description);
    assert.equal(image.width, artwork.width);
    assert.equal(image.height, artwork.height);
    assert.equal(image.encodingFormat, 'image/webp');
    assert.ok(image.contentUrl.includes(artwork.id));
    assert.equal(image.aggregateRating, undefined);
    report.checkedArtwork++;
  }
  const pages = await page.request.get(base + '/sitemap-pages.xml'),
    images = await page.request.get(base + '/sitemap-images.xml');
  assert.equal(pages.status(), 200);
  assert.equal(images.status(), 200);
  const pageXml = await pages.text(),
    imageXml = await images.text();
  assert.ok(pageXml.includes('https://ultraclipart.com/clipart/' + topic + '/'));
  for (const artwork of rows) {
    assert.ok(pageXml.includes('/art/' + artwork.id + '/'));
    assert.ok(imageXml.includes('/art/' + artwork.id + '/'));
    assert.ok(imageXml.includes(artwork.id));
  }
  report.sitemaps = true;
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.errors.push(String(error));
  throw error;
} finally {
  writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  console.log(report);
}
