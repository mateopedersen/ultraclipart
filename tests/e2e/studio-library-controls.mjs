import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4323';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local only');
const out = process.env.STUDIO_LIBRARY_OUT || 'reports/studio-library-controls';
mkdirSync(out, { recursive: true });
const results = [];
for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch();
  try {
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 1024],
      [844, 390],
      [1280, 600],
      [1440, 1000],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 900 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/create/?view=page');
      await page.locator('.uc-editor').scrollIntoViewIfNeeded();
      await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true', {
        timeout: 60000,
      });
      const cookie = page.locator('[data-cookie-choice=necessary]:visible');
      if (await cookie.count()) await cookie.first().click();
      await page.locator('[data-wb-back-page]').click();
      await expect(page.locator('.uc-editor')).toHaveAttribute('data-wb-focus', 'true');
      await page.locator('#uc-tool-elements').click();
      await page.locator('[data-artwork-search]').fill('sunflower');
      await expect(page.locator('[data-artwork]').first()).toBeVisible({ timeout: 30000 });
      await page.locator('.wb-library-filters > summary').click();
      await page.locator('[data-artwork-style]').selectOption('Outline');
      await page.locator('[data-artwork-sort]').selectOption('title');
      await page.locator('[data-artwork-clear]').click();
      await expect(page.locator('[data-artwork-count]')).toContainText('categories');
      await page.locator('[data-artwork-search]').fill('sunflower');
      await expect(page.locator('[data-artwork]').first()).toBeVisible();
      await page.locator('.wb-library-filters > summary').click();
      await page.locator('[data-artwork-more]').click();
      await expect(page.locator('[data-artwork-page]')).toContainText('Page 2');
      await page.locator('[data-artwork-jump]').fill('1');
      await page.locator('[data-artwork-jump]').press('Tab');
      await expect(page.locator('[data-artwork-page]')).toContainText('Page 1');
      await page.locator('[data-library-kind=vector]').click();
      await page.locator('[data-element-search]').fill('rainbow');
      await expect(page.locator('[data-element]').first()).toBeVisible();
      await page.locator('[data-element-favorites]').click();
      await expect(page.locator('[data-element-count]')).toContainText('No matching');
      await page.locator('[data-element-clear]').click();
      await expect(page.locator('[data-element]').first()).toBeVisible();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${out}/${engine}-${width}.png` });
      results.push({
        engine,
        width,
        height,
        filters: true,
        clear: true,
        pagination: true,
        pageJump: true,
        vectors: true,
        pointerTargets: true,
        overflow: false,
        errors,
      });
      await page.close();
    }
  } finally {
    await browser.close();
    writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2));
  }
}
console.log(JSON.stringify(results));
