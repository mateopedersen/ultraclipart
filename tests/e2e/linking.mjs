import { chromium, webkit, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Local only.');
const additions = JSON.parse(readFileSync('data/linking-review.json', 'utf8')).additions;
const art = JSON.parse(readFileSync('data/art.json', 'utf8')).find(
  (a) => a.id === 'glove-clipart-rubber-cleaning-gloves',
);
const out = 'reports/linking/interactions';
mkdirSync(out, { recursive: true });
const report = { started: new Date().toISOString(), checks: [], failures: [] };
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
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const record = (name) => report.checks.push({ engine, width, name, passed: true });
      try {
        await page.goto(base + '/');
        await expect(page.locator('#cookie-notice')).toBeVisible();
        await page.locator('[data-cookie-choice="necessary"]').first().click();
        for (const edge of additions) {
          await page.goto(`${base}/clipart/${edge.source}/`);
          const link = page.locator(
            `[data-related-collections] a[href="/clipart/${edge.target}/"]`,
          );
          await expect(link).toHaveCount(1);
          if (edge.source === 'pear') {
            await link.scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${out}/${engine}-${width}-related-collections.png` });
          }
          if (width === 390) await link.tap();
          else await link.click();
          await page.waitForURL(`**/clipart/${edge.target}/`);
          await expect(page.locator('h1')).not.toBeEmpty();
          record(`${edge.source} → ${edge.target}: actual navigation`);
        }
        for (const destination of ['privacy', 'terms']) {
          await page.goto(base + '/ai-clipart-generator/');
          await page.locator(`.ai-privacy a[href="/${destination}/#builder"]`).click();
          await page.waitForURL(`**/${destination}/#builder`);
          await expect(page.locator('#builder')).toBeVisible();
          const top = await page
            .locator('#builder')
            .evaluate((element) => element.getBoundingClientRect().top);
          assert.ok(top >= -1 && top < 900, `${destination} hash scroll`);
          record(`Builder ${destination}: correct section and native hash scroll`);
        }
        await page.goto(`${base}/art/${art.id}/`);
        await page.locator('summary').filter({ hasText: 'Image details' }).click();
        await page.getByRole('link', { name: 'Compare image, PDF and project formats' }).click();
        await page.waitForURL('**/guides/webp-pdf-and-editable-projects/');
        record('Artwork → file-format guide');
        await page.goto(`${base}/art/${art.id}/`);
        await page.locator('summary').filter({ hasText: 'Print details' }).click();
        await page.getByRole('link', { name: 'Check your print size' }).click();
        await page.waitForURL('**/print-size/**');
        const url = new URL(page.url());
        assert.equal(url.searchParams.get('width'), String(art.width));
        assert.equal(url.searchParams.get('height'), String(art.height));
        record('Artwork → print calculator retains real dimensions');
        for (const route of [
          '/privacy/',
          '/terms/',
          '/print-size/',
          '/for-teachers/',
          '/cookies/',
          '/accessibility/',
          '/contact/',
          '/copyright/',
          '/guides/webp-pdf-and-editable-projects/',
        ]) {
          await page.goto(base + route);
          const links = await page.locator('main a[href^="https://"]').evaluateAll((anchors) =>
            anchors.map((a) => ({
              href: a.href,
              name: a.getAttribute('aria-label') || a.textContent.trim(),
              target: a.target,
              rel: a.rel,
            })),
          );
          assert.ok(links.length > 0, route);
          for (const link of links) {
            assert.ok(link.name, route);
            if (link.target === '_blank') assert.match(link.rel, /\b(noopener|noreferrer)\b/);
            assert.ok(
              !/\bnofollow\b/.test(link.rel),
              'Do not blanket-nofollow these authored references',
            );
          }
          record(`${route}: authored external link names and safety attributes`);
        }
        assert.deepEqual(errors, []);
      } catch (error) {
        report.failures.push({ engine, width, url: page.url(), message: error.message });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
report.finished = new Date().toISOString();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures }));
assert.deepEqual(report.failures, []);
