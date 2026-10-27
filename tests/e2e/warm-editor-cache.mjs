import { chromium, webkit, firefox, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const original = JSON.parse(readFileSync(new URL('../../data/art.json', import.meta.url))).find(
  (art) => art.id === 'baby-pumpkin-costume-clipart',
);
const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw Error('Local only');
const out = 'reports/performance/warm-cache';
mkdirSync(out, { recursive: true });
const report = { started: new Date().toISOString(), checks: [], failures: [] };
const engines = process.env.UC_BROWSER
  ? { [process.env.UC_BROWSER]: { chromium, webkit, firefox }[process.env.UC_BROWSER] }
  : { chromium, webkit };
for (const [engine, implementation] of Object.entries(engines)) {
  const browser = await implementation.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: engine !== 'firefox',
    hasTouch: true,
  });
  await context.addInitScript(() => {
    window.__verifiedCacheProbe = [];
    const original = globalThis.fetch;
    globalThis.fetch = (input, options) => {
      if (String(input).includes('/catalog/') && String(input).endsWith('.webp'))
        window.__verifiedCacheProbe.push({
          cache: options?.cache,
          credentials: options?.credentials,
        });
      return original.call(globalThis, input, options);
    };
  });
  const page = await context.newPage();
  try {
    const timings = [];
    for (let pass = 0; pass < 2; pass++) {
      await page.goto(base + '/edit/baby-pumpkin-costume-clipart/');
      await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true', {
        timeout: 30000,
      });
      await expect(page.locator('.uc-canvas image')).toHaveCount(1);
      const timing = await page.evaluate(() => {
        const item = performance
          .getEntriesByType('resource')
          .find((e) => e.name.endsWith('/baby-pumpkin-costume-clipart.webp'));
        return item
          ? {
              transferSize: item.transferSize,
              encodedBodySize: item.encodedBodySize,
              duration: item.duration,
            }
          : null;
      });
      assert.ok(timing, 'original request must be observable');
      const policy = await page.evaluate(() => window.__verifiedCacheProbe);
      assert.deepEqual(
        policy,
        [{ cache: 'default', credentials: 'omit' }],
        'both visits must permit the browser HTTP cache while preserving credential isolation',
      );
      timings.push(timing);
      const consent = page.locator('#cookie-notice [data-cookie-choice="necessary"]:visible');
      if (await consent.count()) await consent.click();
      // Fit uses the decoded screen copy. Zoom must still expose the exact
      // verified original on both cold and warm visits, never an upscaled copy.
      for (let i = 0; i < 12; i++) await page.locator('[data-action="zoom-in"]').click();
      await expect(page.locator('.uc-canvas image')).toHaveAttribute(
        'href',
        /^data:image\/webp;base64,/,
      );
      const hash = await page.locator('.uc-canvas image').evaluate(async (image) => {
        const bytes = Uint8Array.from(atob(image.getAttribute('href').split(',')[1]), (c) =>
          c.charCodeAt(0),
        );
        return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
          .map((n) => n.toString(16).padStart(2, '0'))
          .join('');
      });
      assert.equal(hash, original.files.webp.sha256);
    }
    assert.ok(timings[0].transferSize > 0, 'first load downloads and verifies the source');
    // Browser cache decisions vary, especially in ephemeral WebKit contexts.
    // Record the actual transfer; do not turn a cache miss into a claimed hit.
    assert.ok(timings[1].encodedBodySize > 0);
    report.checks.push({
      engine,
      passed: true,
      check: 'Verified original and cache-permitting fetch policy on cold/warm visits',
      warmZeroTransferReported: timings[1].transferSize === 0,
      timings,
    });
  } catch (error) {
    report.failures.push({ engine, error: error.stack });
  } finally {
    await context.close();
    await browser.close();
  }
}
report.finished = new Date().toISOString();
writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
assert.deepEqual(report.failures, []);
