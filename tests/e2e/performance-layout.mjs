import { chromium, webkit, firefox, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw Error('Local only');
const out = process.env.PERFORMANCE_LAYOUT_OUT || 'reports/performance/layout';
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
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const check = (name, details = {}) =>
      report.checks.push({ engine, width, name, passed: true, ...details });
    try {
      for (const path of ['/guides/', '/for-teachers/']) {
        await page.goto(base + path);
        const consent = page.locator('[data-cookie-choice="necessary"]:visible').first();
        if (await consent.count()) await consent.click();
        const captures = page.locator('.gm-demonstration');
        assert.ok(await captures.count());
        for (const demonstration of await captures.all()) {
          const panel = await demonstration.evaluate((el) =>
            el.closest('[data-guide-panel]')?.getAttribute('data-guide-panel'),
          );
          if (panel) await page.locator(`[data-guide-goal="${panel}"]`).click();
          const disclosure = demonstration.locator('xpath=ancestor::details[1]');
          if ((await disclosure.count()) && (await disclosure.getAttribute('open')) === null)
            await disclosure.locator('summary').click();
          const picture = demonstration.locator('img.gm-screen-image');
          await expect(picture).toHaveAttribute('loading', 'lazy');
          await picture.scrollIntoViewIfNeeded();
          await expect
            .poll(() => picture.evaluate((img) => img.complete && img.naturalWidth > 0))
            .toBe(true);
          const geometry = await demonstration.evaluate((el) => {
            const img = el.querySelector('img.gm-screen-image'),
              svg = el.querySelector('svg.gm-screen-image');
            const a = img.getBoundingClientRect(),
              b = svg.getBoundingClientRect(),
              vb = svg.viewBox.baseVal;
            return {
              crop: [vb.width, vb.height],
              natural: [img.naturalWidth, img.naturalHeight],
              difference: Math.max(
                Math.abs(a.x - b.x),
                Math.abs(a.y - b.y),
                Math.abs(a.width - b.width),
                Math.abs(a.height - b.height),
              ),
            };
          });
          assert.deepEqual(geometry.natural, geometry.crop);
          assert.ok(geometry.difference < 1, 'annotation and crop must align');
          const pins = demonstration.locator('.gm-screen-pin');
          const last = pins.last(),
            number = await last.getAttribute('data-screen-select');
          await last.click();
          await expect(last).toHaveAttribute('aria-pressed', 'true');
          await expect(demonstration.locator(`[data-screen-target="${number}"]`)).toHaveClass(
            /is-active/,
          );
          assert.match(
            await demonstration.locator('figcaption a').getAttribute('href'),
            /^\/(guide-screens|home-art)\//,
          );
        }
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (path === '/guides/') await page.locator('[data-guide-goal]').first().click();
        await captures
          .first()
          .screenshot({ path: `${out}/${engine}-${width}-${path.replaceAll('/', '')}.png` });
        check(`Lazy real captures, crop alignment and interactive annotations: ${path}`, {
          captures: await captures.count(),
        });
      }
      await page.route('**/search-manifest.json', async (route) => {
        const response = await route.fetch();
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.fulfill({ response });
      });
      await page.goto(base + '/search/?q=baby');
      await expect(page.locator('#result-count')).toContainText('baby');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.ok(
        await page
          .locator('.search-kind-tabs button span')
          .evaluateAll((nodes) => nodes.every((node) => node.getBoundingClientRect().width >= 30)),
      );
      check('Search counts keep reserved space and the page fits');
      await page.goto(base + '/edit/baby-pumpkin-costume-clipart/');
      await expect(page.locator('[data-artwork-canvas]')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('.uc-editor')).not.toHaveAttribute('data-processing', 'true');
      const geometry = await page.locator('.uc-canvas').evaluate((el) => {
        const rect = el.getBoundingClientRect(),
          svg = el.querySelector('[data-artwork-canvas]').viewBox.baseVal;
        return { actual: rect.width / rect.height, expected: svg.width / svg.height };
      });
      assert.ok(Math.abs(geometry.actual - geometry.expected) < 0.01);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      check('Artwork editor renders original at the correct canvas ratio');
      assert.deepEqual(errors, []);
    } catch (error) {
      report.failures.push({ engine, width, error: error.stack, pageErrors: errors });
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
