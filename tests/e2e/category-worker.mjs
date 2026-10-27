import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4323';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local only');
const out = process.env.CATEGORY_WORKER_OUT || 'reports/performance/category-worker';
mkdirSync(out, { recursive: true });
const report = [];
for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch();
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: width === 390,
      });
      const page = await context.newPage();
      const requests = [],
        errors = [];
      page.on('request', (r) => requests.push(r.url()));
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route('**/category-search/*.json', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        await route.continue();
      });
      await page.goto(base + '/categories/');
      await expect(page.locator('#discovery-controls')).toHaveAttribute('data-ready', 'true');
      assert.equal(
        requests.some((url) => /\/category-search\//.test(url)),
        false,
        'Index waits for search intent',
      );
      const input = page.locator('#topic-filter');
      if (width < 980) await page.locator('#discovery-controls > summary').click();
      await input.fill('baby elephant');
      await input.fill('sunflower');
      const first = page.locator('#subject-grid [data-topic]:visible a').first();
      await expect(first).toHaveAttribute('href', '/clipart/sunflower/');
      await expect(page.locator('#topic-directory-heading')).toHaveText('Results for “sunflower”');
      await input.fill('sunflower elephant submarine');
      await expect(page.locator('#subject-grid [data-topic]:visible')).toHaveCount(0);
      await input.fill('please find baby elephant clipart for me');
      await expect(first).toHaveAttribute('href', '/clipart/baby-elephant/');
      await input.fill('smiling rabbit watercolor');
      await expect(
        page.locator('#subject-grid [data-topic]:visible a[href="/clipart/rabbit/"]'),
      ).toBeVisible();
      if (width === 390) await first.tap();
      else await first.click();
      await page.waitForURL('**/clipart/rabbit/');
      assert.deepEqual(errors, []);
      await context.close();

      const recovery = await browser.newPage({ viewport: { width, height: 900 } });
      await recovery.route('**/category-search/*.json', (route) => route.abort('failed'));
      await recovery.goto(base + '/categories/');
      if (width < 980) await recovery.locator('#discovery-controls > summary').click();
      await recovery.locator('#topic-filter').fill('sunflower');
      await expect(recovery.locator('#topic-result-count')).toContainText('could not load');
      assert.equal(
        await recovery.locator('#subject-grid [data-topic]:visible').count(),
        12,
        'Existing results survive failure',
      );
      await recovery.unroute('**/category-search/*.json');
      await recovery.locator('#topic-filter').fill('baby elephant');
      await expect(
        recovery.locator('#subject-grid [data-topic]:visible a').first(),
      ).toHaveAttribute('href', '/clipart/baby-elephant/');
      await recovery.locator('#reset-subjects').click();
      await expect(recovery.locator('#subject-grid [data-topic]:visible')).toHaveCount(12);
      await recovery.close();
      report.push({
        engine,
        width,
        deferred: true,
        race: true,
        longTail: true,
        exactDestination: true,
        recovery: true,
        errors,
      });
    }
  } finally {
    await browser.close();
  }
}
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
