import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4323',
  engine = process.env.UC_BROWSER || 'chromium';
const browser = await { chromium, webkit }[engine].launch(),
  context = await browser.newContext(),
  page = await context.newPage();
const report = { engine, states: [], errors: [], status: 'running' };
page.on('pageerror', (e) => report.errors.push(e.message));
try {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base + '/collections/');
    await expect(page.locator('#latest-collections>a')).toHaveCount(8);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    const groups = await page.locator('.collection-group-tile').count();
    assert.ok(groups >= 15);
    await page.locator('#latest-collections img').evaluateAll((imgs) =>
      Promise.all(
        imgs.map(async (img) => {
          img.loading = 'eager';
          await img.decode();
        }),
      ),
    );
    report.states.push({ width, collections: 8, groups });
  }
  const response = await page.request.get(base + '/collection-feed.json');
  assert.equal(response.status(), 200);
  const feed = await response.json();
  const first = feed.items[0];
  await page.locator('#latest-collections>a').first().click();
  await page.waitForURL('**' + first.href);
  await expect(page.locator('main h1')).toBeVisible();
  await page.clock.install();
  await page.route('**/collection-feed.json', (r) =>
    r.fulfill({
      json: {
        version: 'test-release-new-collection',
        items: [
          { ...feed.items[1], count: feed.items[1].count + 1 },
          ...feed.items.filter((_, i) => i !== 1),
        ],
      },
    }),
  );
  await page.goto(base + '/collections/');
  await page.clock.fastForward(61000);
  await expect(page.locator('#latest-collections')).toHaveAttribute(
    'data-version',
    'test-release-new-collection',
  );
  await expect(page.locator('#latest-collections>a').first()).toHaveAttribute(
    'href',
    feed.items[1].href,
  );
  await expect(page.locator('#latest-collections>a').first().locator('p')).toContainText(
    String(feed.items[1].count + 1),
  );
  report.liveRefresh = true;
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} finally {
  mkdirSync('reports/categories-refresh', { recursive: true });
  writeFileSync(
    `reports/categories-refresh/collections-${engine}.json`,
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report));
