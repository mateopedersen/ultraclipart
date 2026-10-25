import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:4335';
const engine = process.env.UC_BROWSER ?? 'chromium';
const output = resolve(process.env.EVIDENCE_DIR ?? 'reports/animal-gallery', engine);
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const catalog = read('../../data/art.json');
const collectionId = process.env.SOURCE_COLLECTION || 'owner-animal-2026-10-23';
const collectionIds = new Set(
  process.env.SOURCE_COLLECTIONS?.split(',').filter(Boolean) || [collectionId],
);
const items = catalog.filter(
  (art) =>
    collectionIds.has(art.sourceCollection) ||
    collectionIds.has(art.replacesArtwork?.sourceCollection),
);
const topics = [...new Set(items.map((art) => art.topic))].sort();
const manifest = read('../../data/publication.json');
const files = new Map(manifest.files.map((file) => [`${file.assetId}:${file.kind}`, file]));
const url = (art, kind) =>
  base.startsWith('https:') ? files.get(`${art.id}:${kind}`).url : new URL(art[kind], base).href;
mkdirSync(output, { recursive: true });
assert.equal(items.length, Number(process.env.EXPECTED_ARTWORKS || 2500));
assert.equal(topics.length, Number(process.env.EXPECTED_TOPICS || 50));
const browser = await { chromium, firefox, webkit }[engine].launch({
  headless: true,
  ...(process.env.BROWSER_BIN ? { executablePath: process.env.BROWSER_BIN } : {}),
});
const context = await browser.newContext({ acceptDownloads: true });
const report = {
  base,
  engine,
  at: new Date().toISOString(),
  states: [],
  downloads: [],
  errors: [],
  status: 'running',
};
let page;
try {
  for (const topic of topics) {
    // Separate tabs keep native download permissions and page-error evidence isolated.
    await page?.close();
    page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push({ topic, error: error.message }));
    const expected = items.filter((art) => art.topic === topic);
    const response = await page.goto(`${base}/clipart/${topic}/`);
    assert.equal(response.status(), 200);
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('.art-card')).toHaveCount(expected.length);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://ultraclipart.com/clipart/${topic}/`,
    );
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    assert.equal(robots.includes('noindex'), false);
    const structured = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((nodes) => nodes.map((node) => JSON.parse(node.textContent)));
    const collection = structured.flat().find((entry) => entry['@type'] === 'CollectionPage');
    assert.equal(collection.mainEntity.numberOfItems, expected.length);
    assert.equal(collection.mainEntity.itemListElement.length, expected.length);
    if (topic === 'octopus') {
      await expect(page.locator('.chips a[href="/clipart/crab/"]')).toHaveCount(1);
      await expect(page.locator('.chips a[href="/clipart/lobster/"]')).toHaveCount(1);
      await expect(page.locator('.chips a[href="/clipart/cow/"]')).toHaveCount(0);
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.querySelectorAll('.art-card img')].map(async (image) => {
          image.loading = 'eager';
          await image.decode();
          if (!image.naturalWidth || !image.naturalHeight)
            throw new Error('Undecodable gallery image');
        }),
      );
    });
    for (const art of expected) {
      const card = page.locator(`.art-card[data-id="${art.id}"]`);
      await expect(card.locator('img')).toHaveAttribute('alt', art.alt);
      await expect(card.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute(
        'href',
        `/edit/${art.id}/`,
      );
      for (const kind of ['webp', 'pdf'])
        assert.equal(
          await card.locator(`a[data-download-format="${kind}"]`).getAttribute('href'),
          url(art, kind),
        );
    }
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, `${topic}: ${width}px horizontal overflow`);
      const geometry = await page.locator('.card-actions').evaluateAll((groups) =>
        groups.map((group) => {
          const bounds = group.getBoundingClientRect();
          const edit = group.firstElementChild.getBoundingClientRect();
          return {
            count: group.children.length,
            height: edit.height,
            centered: Math.abs(bounds.x + bounds.width / 2 - edit.x - edit.width / 2) < 1,
          };
        }),
      );
      for (const edit of geometry) {
        assert.equal(edit.count, 1, `${topic}: one editor action`);
        assert.ok(edit.height >= 44 && edit.centered, `${topic}: centered, touch-friendly action`);
      }
      const rows = await page.locator('.art-card').evaluateAll((cards) => {
        const groups = new Map();
        for (const card of cards) {
          const top = Math.round(card.getBoundingClientRect().top);
          const row = groups.get(top) ?? [];
          row.push({
            formats: card.querySelector('.formats').getBoundingClientRect().top,
            actions: card.querySelector('.card-actions').getBoundingClientRect().top,
          });
          groups.set(top, row);
        }
        return [...groups.values()];
      });
      for (const row of rows)
        for (const group of ['formats', 'actions'])
          assert.ok(
            Math.max(...row.map((position) => position[group])) -
              Math.min(...row.map((position) => position[group])) <=
              1,
            `${topic}: ${width}px ${group} must align across the gallery row`,
          );
      const scan = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const violations = scan.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => node.target),
      }));
      report.states.push({ topic, width, illustrations: expected.length, overflow, violations });
      assert.deepEqual(violations, [], `${topic}: ${width}px accessibility`);
      if (
        [
          'cat',
          'penguin',
          'octopus',
          'zebra',
          'apple',
          'kiwi-fruit',
          'tangerine',
          'green-apple',
          'dragon-fruit',
          'melon',
        ].includes(topic) &&
        [390, 1440].includes(width)
      )
        await page.screenshot({ path: resolve(output, `${topic}-${width}.png`), fullPage: false });
    }
    const art = expected[0];
    const detail = await page.goto(`${base}/art/${art.id}/`);
    assert.equal(detail.status(), 200);
    await page.locator('#art-preview img').evaluate((image) => image.decode());
    for (const kind of ['webp', 'pdf']) {
      await page.goto(`${base}/art/${art.id}/`);
      const entry = page.locator(`.detail-actions a[data-download-format="${kind}"]`);
      assert.equal(await entry.getAttribute('href'), url(art, kind));
      await entry.click();
      await expect(page.locator(`#download-dialog [data-final-download="${kind}"]`)).toBeVisible();
      assert.equal(page.url(), `${base}/art/${art.id}/`);
      const link = page.locator(`[data-final-download="${kind}"]`);
      assert.equal(await link.evaluate((element) => element.href), url(art, kind));
      const pending = page.waitForEvent('download');
      await link.click();
      const download = await pending;
      assert.equal(download.suggestedFilename(), `${art.id}.${kind}`);
      const bytes = readFileSync(await download.path());
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      assert.equal(bytes.length, art.files[kind].bytes);
      assert.equal(sha256, art.files[kind].sha256);
      report.downloads.push({ topic, id: art.id, kind, bytes: bytes.length, sha256 });
      await download.delete();
    }
    console.log(JSON.stringify({ topic, status: 'passed', illustrations: expected.length }));
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  await page?.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  console.log(
    JSON.stringify({
      status: report.status,
      states: report.states.length,
      downloads: report.downloads.length,
      failure: report.failure,
    }),
  );
}
