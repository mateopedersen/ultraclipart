import { chromium, webkit, firefox, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw Error('Local only');
const out = process.env.PERFORMANCE_INTERACTIONS_OUT || 'reports/performance/interactions';
mkdirSync(out, { recursive: true });
const report = { started: new Date().toISOString(), checks: [], failures: [] };
const engines = process.env.UC_BROWSER
  ? { [process.env.UC_BROWSER]: { chromium, webkit, firefox }[process.env.UC_BROWSER] }
  : { chromium, webkit };
for (const [engine, implementation] of Object.entries(engines)) {
  const browser = await implementation.launch();
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width === 390,
      isMobile: width === 390 && engine !== 'firefox',
    });
    const page = await context.newPage();
    const requests = [],
      errors = [];
    page.on('request', (r) => requests.push(r.url()));
    page.on('pageerror', (e) => errors.push(e.message));
    const go = async (path) => {
      const response = await page.goto(base + path);
      assert.ok([200, 304].includes(response.status()), `${path}: HTTP ${response.status()}`);
      await expect(page.locator('main')).toBeVisible();
      const consent = page.locator('[data-cookie-choice="necessary"]:visible').first();
      if (await consent.count()) await consent.click();
    };
    const record = (check) => report.checks.push({ engine, width, check, passed: true });
    try {
      for (const route of [
        '/',
        '/clipart/baby/',
        '/art/baby-pumpkin-costume-clipart/',
        '/library-index/',
      ]) {
        await go(route);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
          route,
        );
        const images = page.locator('main img[src^="/previews/"]');
        assert.ok(await images.count(), route);
        await expect(images.first()).toHaveAttribute(
          'srcset',
          route.startsWith('/art/') ? /960\.webp/ : /96\.webp/,
        );
        await images.first().scrollIntoViewIfNeeded();
        await expect
          .poll(() => images.first().evaluate((img) => img.complete && img.naturalWidth > 0))
          .toBe(true);
        if (route === '/') await page.screenshot({ path: `${out}/${engine}-${width}-home.png` });
        record(`Responsive previews and viewport: ${route}`);
      }
      await go('/');
      await page.locator('#search-q').fill('baby pumpkin costume');
      const suggestion = page.locator(
        '.search-suggestions a[href="/art/baby-pumpkin-costume-clipart/"]',
      );
      await expect(suggestion).toBeVisible();
      await expect(suggestion.locator('img')).toHaveAttribute('srcset', /96\.webp/);
      if (width === 390) await suggestion.tap();
      else await suggestion.click();
      await page.waitForURL('**/art/baby-pumpkin-costume-clipart/');
      await page.locator('[data-related-mode="subject"]').click();
      await expect(page.locator('.related-card img').first()).toHaveAttribute('srcset', /96\.webp/);
      const download = page
        .locator('[data-download-open="baby-pumpkin-costume-clipart"][data-download-format="webp"]')
        .first();
      assert.match(await download.getAttribute('href'), /\/catalog\/.*\.webp$/);
      await download.click();
      await expect(page.locator('#download-dialog')).toBeVisible();
      await expect
        .poll(() =>
          page
            .locator('[data-download-preview]')
            .evaluate((img) => img.complete && img.naturalWidth > 0),
        )
        .toBe(true);
      await page.keyboard.press('Escape');
      record(
        'Search suggestion navigation, regenerated related cards and original download lightbox',
      );

      requests.length = 0;
      await go('/create/');
      await page.locator('.uc-editor').scrollIntoViewIfNeeded();
      await expect(page.locator('.uc-workspace')).not.toHaveAttribute('inert', '');
      await page.locator('#uc-tool-elements').click();
      await expect(page.locator('[data-artwork-count]')).toContainText('categories');
      await expect(page.locator('.wb-category-tile')).toHaveCount(6);
      assert.equal(
        requests.some((u) => u.endsWith('/studio-catalog.json')),
        false,
        'Full catalog must wait for a user action',
      );
      assert.equal(
        requests.some((u) => /\/element-library\.[^/]+\.js/.test(u)),
        false,
        'Vector code must wait for its tab',
      );
      record('Studio starts with six category choices, without full catalog or vector download');
      // Simulate a slow first subject load. Returning to categories must win.
      await page.route('**/studio-catalog.json', async (route) => {
        const response = await route.fetch();
        await new Promise((resolve) => setTimeout(resolve, 400));
        await route.fulfill({ response });
      });
      await page.locator('.wb-category-tile').first().click();
      await expect(page.locator('.uc-editor')).toHaveAttribute('data-library-browse', 'topics');
      await page.locator('.wb-category-tile').first().click();
      await expect(page.locator('[data-artwork-grid]')).toHaveAttribute('aria-busy', 'true');
      await page.locator('[data-library-home]').click();
      await expect(page.locator('[data-artwork-grid]')).not.toHaveAttribute('aria-busy', 'true');
      await expect(page.locator('.uc-editor')).toHaveAttribute('data-library-browse', 'categories');
      await expect(page.locator('[data-artwork-count]')).toContainText('categories');
      await page.locator('.wb-category-tile').first().click();
      await page.locator('.wb-category-tile').first().click();
      await expect(page.locator('.uc-editor')).toHaveAttribute('data-library-browse', 'artwork');
      await page.locator('[data-artwork-scope="featured"]').click();
      await expect(page.locator('[data-artwork-count]')).toHaveText('1–6 of 500 artworks');
      await expect(page.locator('[data-artwork]')).toHaveCount(6);
      await page.locator('[data-artwork-search]').fill('baby pumpkin costume');
      await expect(page.locator('[data-artwork="baby-pumpkin-costume-clipart"]')).toBeVisible();
      await page.locator('[data-artwork="baby-pumpkin-costume-clipart"]').click();
      await expect(page.locator('[data-artwork-count]')).toContainText('added to your canvas');
      const saved = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('ultraclipart:editor:v1:my-clipart')),
      );
      assert.equal(saved.layers.length, 1);
      await page.locator('.wb-library-filters > summary').click();
      await page.locator('[data-artwork-clear]').click();
      await expect(page.locator('[data-artwork-count]')).toContainText('categories');
      await page.locator('.wb-category-tile').first().click();
      await page.locator('.wb-category-tile').first().click();
      await expect(page.locator('.uc-editor')).toHaveAttribute('data-library-browse', 'artwork');
      await page.locator('[data-artwork-scope="featured"]').click();
      await expect(page.locator('[data-artwork-count]')).toHaveText('1–6 of 500 artworks');
      await page.locator('[data-artwork-more]').click();
      await expect(page.locator('[data-artwork-count]')).toHaveText('7–12 of 500 artworks');
      record('Full-catalog search, request race, original artwork insertion, clear and pagination');

      await page.locator('[data-library-kind="vector"]').click();
      await expect(page.locator('[data-element-count]')).toHaveText('1–6 of 2,000 elements');
      await page.locator('[data-element-search]').fill('rainbow');
      await page.locator('[data-element]').first().click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              JSON.parse(localStorage.getItem('ultraclipart:editor:v1:my-clipart')).layers.length,
          ),
        )
        .toBe(2);
      await page.reload();
      await page.locator('.uc-editor').scrollIntoViewIfNeeded();
      await expect(page.locator('.uc-workspace')).not.toHaveAttribute('inert', '', {
        timeout: 30000,
      });
      assert.equal(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem('ultraclipart:editor:v1:my-clipart')).layers.length,
        ),
        2,
      );
      record('Lazy vector library, search, insertion and saved project preserved after reload');
      assert.deepEqual(errors, []);
    } catch (e) {
      report.failures.push({ engine, width, error: e.stack, pageErrors: errors });
      await page.screenshot({ path: `${out}/${engine}-${width}-failure.png` }).catch(() => {});
    } finally {
      await context.close();
    }
    writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  }
  await browser.close();
}
report.finished = new Date().toISOString();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
assert.deepEqual(report.failures, []);
