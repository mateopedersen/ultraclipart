import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Local only.');
const output = 'reports/collection-navigation/arrows';
mkdirSync(output, { recursive: true });
const report = { checks: [], failures: [], started: new Date().toISOString() };
for (const [engine, implementation] of Object.entries({ chromium, webkit })) {
  const browser = await implementation.launch();
  try {
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: width < 768,
        isMobile: width < 768,
        reducedMotion: 'reduce',
      });
      // This suite isolates navigation; regional notice behavior has its own suite.
      await context.route('**/api/cookie-region.json', (route) =>
        route.fulfill({
          contentType: 'application/json',
          body: '{"showNotice":false}',
        }),
      );
      const page = await context.newPage();
      try {
        for (const id of ['sunflower-straw-hat', 'baby-elephant-bright-eyed-manga-clipart']) {
          const response = await page.goto(`${base}/art/${id}/`);
          assert.equal(response.status(), 200);
          const link = page.locator('.art-collection-link');
          const arrow = link.locator('img');
          await expect(arrow).toHaveAttribute(
            'src',
            '/illustrations/actions/arrow-right-collection.svg',
          );
          await expect(arrow).toHaveAttribute('alt', '');
          await link.scrollIntoViewIfNeeded();
          await expect
            .poll(() => arrow.evaluate((img) => img.complete && img.naturalWidth > 0))
            .toBe(true);
          const geometry = await link.evaluate((element) => {
            const link = element.getBoundingClientRect();
            const circle = element.querySelector('.art-collection-arrow').getBoundingClientRect();
            const icon = element.querySelector('img').getBoundingClientRect();
            return {
              height: link.height,
              circle: circle.width,
              icon: icon.width,
              center: Math.abs(circle.top + circle.height / 2 - (icon.top + icon.height / 2)),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
            };
          });
          assert.ok(geometry.height >= 48 && geometry.circle === 40 && geometry.icon === 22);
          assert.ok(geometry.center < 1 && !geometry.overflow);
          await link.focus();
          if (id === 'sunflower-straw-hat' && [390, 1440].includes(width))
            await link.screenshot({ path: `${output}/${engine}-${width}.png` });
          const href = await link.getAttribute('href');
          if (width < 768) await arrow.tap();
          else await arrow.click();
          await page.waitForURL(base + href);
          await expect(page.locator('h1')).toBeVisible();
          report.checks.push({ engine, width, id, destination: href, geometry });
        }
      } catch (error) {
        report.failures.push({ engine, width, message: error.message, url: page.url() });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
report.finished = new Date().toISOString();
writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures }));
assert.deepEqual(report.failures, []);
