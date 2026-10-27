import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Local only.');
const output = 'reports/latest-artwork';
mkdirSync(output, { recursive: true });
const report = {
  checks: [],
  errors: [],
  fixture:
    'A simulated index release promotes an existing real artwork. No content is uploaded or published.',
};
for (const [engine, implementation] of Object.entries({ chromium, webkit })) {
  const browser = await implementation.launch();
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: width === 390,
        isMobile: width === 390,
      });
      const page = await context.newPage();
      try {
        await page.clock.install();
        await context.addInitScript(() => localStorage.setItem('new-page-preserved', 'keep'));
        const manifest = await (await page.request.get(base + '/search-data/manifest.json')).json();
        const ranked = await (
          await page.request.get(`${base}/search-data/${manifest.version}/ranked/newest/0.json`)
        ).json();
        const promoted = ranked.ids[40];
        const nextRanked = {
          ...ranked,
          ids: [promoted, ...ranked.ids.filter((id) => id !== promoted)],
          ordinals: [ranked.ordinals[40], ...ranked.ordinals.filter((_, i) => i !== 40)],
        };
        let mode = 'current';
        await page.route('**/api/cookie-region.json', (route) =>
          route.fulfill({ contentType: 'application/json', body: '{"showNotice":false}' }),
        );
        await page.route('**/search-data/**', async (route) => {
          const url = new URL(route.request().url());
          if (url.pathname === '/search-data/manifest.json') {
            if (mode === 'error') return route.fulfill({ status: 503, body: '{}' });
            return route.fulfill({
              contentType: 'application/json',
              body: JSON.stringify({
                ...manifest,
                version: mode === 'updated' ? 'new-page-regression' : manifest.version,
              }),
            });
          }
          if (url.pathname.includes('/new-page-regression/')) {
            if (url.pathname.endsWith('/ranked/newest/0.json'))
              return route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(nextRanked),
              });
            const response = await route.fetch({
              url: url.href.replace('/new-page-regression/', `/${manifest.version}/`),
            });
            return route.fulfill({ response });
          }
          return route.continue();
        });
        await page.goto(base + '/new/');
        const root = page.locator('[data-new-artwork]');
        await expect(root).toHaveAttribute('data-ready', 'true');
        await expect(root.locator('.art-card')).toHaveCount(32);
        assert.equal(
          await root.locator('.art-card').first().getAttribute('data-id'),
          ranked.ids[0],
        );
        await root.locator('[data-new-more]').click();
        await expect(root.locator('.art-card')).toHaveCount(64);
        const ids = await root
          .locator('.art-card')
          .evaluateAll((cards) => cards.map((card) => card.dataset.id));
        assert.equal(new Set(ids).size, 64);
        await expect(root.locator('[data-new-refresh]')).toBeEnabled();
        mode = 'updated';
        await page.clock.fastForward(30_001);
        await expect(root).toHaveAttribute('data-catalog-version', 'new-page-regression');
        await expect(root.locator('.art-card')).toHaveCount(32);
        assert.equal(await root.locator('.art-card').first().getAttribute('data-id'), promoted);
        mode = 'error';
        await root.locator('[data-new-refresh]').click();
        await expect(root.locator('[data-new-status]')).toContainText('could not be refreshed');
        await expect(root.locator('.art-card')).toHaveCount(32);
        assert.equal(await page.evaluate(() => localStorage.getItem('new-page-preserved')), 'keep');
        mode = 'current';
        await root.locator('[data-new-refresh]').click();
        await expect(root).toHaveAttribute('data-catalog-version', manifest.version);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
        await page.screenshot({ path: `${output}/${engine}-${width}.png` });
        const href = await root.locator('.art-picture').first().getAttribute('href');
        if (width === 390) await root.locator('.art-picture').first().tap();
        else await root.locator('.art-picture').first().click();
        await page.waitForURL(base + href);
        await expect(page.locator('h1')).toBeVisible();
        report.checks.push({
          engine,
          width,
          initial: 32,
          expanded: 64,
          automaticRefresh: true,
          refresh: true,
          recovery: true,
          dataPreserved: true,
          navigation: true,
        });
      } catch (error) {
        report.errors.push({ engine, width, error: error.message });
      } finally {
        await context.close();
      }
    }
    const plain = await browser.newContext({ javaScriptEnabled: false });
    const page = await plain.newPage();
    await page.goto(base + '/new/');
    await expect(page.locator('[data-new-artwork] .art-card')).toHaveCount(32);
    await expect(page.locator('a[href="/search/?sort=newest"]')).toBeVisible();
    await plain.close();
  } finally {
    await browser.close();
  }
}
writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
assert.deepEqual(report.errors, []);
