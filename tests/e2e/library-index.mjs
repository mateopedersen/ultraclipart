import { chromium, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { indexableTopics } from '../../src/lib/sitemaps.ts';
const base = process.env.BASE_URL || 'http://127.0.0.1:4323';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error('Local preview only');
const json = (name) => JSON.parse(readFileSync(`data/${name}`, 'utf8'));
const subjects = indexableTopics(json('art.json'), [
  ...json('topics.json').topics,
  ...json('extra-topics.json'),
]);
const expected = subjects.map((s) => `/clipart/${s.slug}/`).sort();
const out = 'reports/library-index';
mkdirSync(out, { recursive: true });
const report = {
  started: new Date().toISOString(),
  viewports: [],
  links: [],
  noJavaScript: [],
  errors: [],
};
for (const [engine, implementation] of Object.entries({ chromium, webkit })) {
  const browser = await implementation.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push({ engine, message: error.message }));
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const res = await page.goto(`${base}/library-index/`, { waitUntil: 'domcontentloaded' });
      assert.equal(res.status(), 200);
      await page.evaluate(() => document.fonts.ready);
      const cookie = page.locator('[data-cookie-choice="necessary"]:visible').first();
      if (await cookie.count()) await cookie.click();
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://ultraclipart.com/library-index/',
      );
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'index,follow,max-image-preview:large',
      );
      const targets = await page
        .locator('[data-index-subject] a')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')).sort());
      assert.deepEqual(targets, expected);
      assert.equal(await page.locator('main a[href^="/search/"]').count(), 0);
      const bounds = await page.locator('.library-index').evaluate((root) => {
        const problems = [];
        if (document.documentElement.scrollWidth > innerWidth + 1)
          problems.push('horizontal overflow');
        for (const element of root.querySelectorAll('h1, h2, h3, a, input, button, img')) {
          if (!element.getClientRects().length) continue;
          const r = element.getBoundingClientRect();
          if (r.width && (r.left < -1 || r.right > innerWidth + 1))
            problems.push(`${element.tagName} outside viewport`);
          if (element.tagName !== 'IMG' && element.scrollWidth > element.clientWidth + 2)
            problems.push(`${element.tagName} clipped`);
        }
        return problems;
      });
      assert.deepEqual(bounds, []);
      await expect(page.locator('[data-index-filter]')).toBeVisible();
      await page.locator('#library-subject-search').fill('baby');
      const matches = await page.locator('[data-index-subject]:visible').count();
      assert.ok(matches > 0 && matches < subjects.length);
      await expect(page.locator('[data-index-subject] a[href="/clipart/baby/"]')).toBeVisible();
      await page.locator('#library-subject-search').fill('zzzz-no-such-subject');
      await expect(page.locator('[data-index-empty]')).toBeVisible();
      assert.equal(await page.locator('[data-index-subject]:visible').count(), 0);
      await page.locator('[data-index-clear]').click();
      assert.equal(await page.locator('[data-index-subject]:visible').count(), subjects.length);
      await page.locator('.library-index-alphabet a[href="#subjects-b"]').click();
      assert.equal(new URL(page.url()).hash, '#subjects-b');
      await page.locator('[data-index-subject] a[href="/clipart/baby/"]').click();
      await page.waitForURL('**/clipart/baby/');
      await page.goto(`${base}/library-index/`);
      if (width === 390 || width === 1440) {
        await expect
          .poll(() =>
            page
              .locator('.library-index-art img')
              .evaluateAll((images) => images.every((img) => img.complete && img.naturalWidth > 0)),
          )
          .toBe(true);
        await page.screenshot({ path: `${out}/${engine}-${width}.png` });
        const axe = await new AxeBuilder({ page })
          .setLegacyMode(engine === 'webkit')
          .include('.library-index')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        assert.deepEqual(
          axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
          [],
        );
      }
      report.viewports.push({
        engine,
        width,
        subjects: subjects.length,
        filter: true,
        empty: true,
        clear: true,
        alphabet: true,
        navigation: true,
        layout: true,
      });
    }
    const nojs = await browser.newContext({ javaScriptEnabled: false });
    const crawler = await nojs.newPage();
    await crawler.goto(`${base}/library-index/`);
    assert.equal(await crawler.locator('[data-index-subject] a').count(), subjects.length);
    assert.equal(await crawler.locator('[data-index-subject]:visible').count(), subjects.length);
    await expect(crawler.locator('[data-index-filter]')).toBeHidden();
    report.noJavaScript.push({ engine, subjects: subjects.length, allLinksVisible: true });
    if (engine === 'chromium') {
      const hrefs = await crawler
        .locator('main a[href^="/"]')
        .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute('href')))]);
      for (const href of hrefs) {
        const result = await page.request.get(base + href);
        assert.equal(result.status(), 200, href);
        report.links.push({ href, status: result.status() });
      }
      const sitemap = await (await page.request.get(base + '/sitemap.xml')).text();
      assert.ok(sitemap.includes('https://ultraclipart.com/sitemap-images.xml'));
      const pages = await (await page.request.get(base + '/sitemap-pages.xml')).text();
      assert.ok(pages.includes('https://ultraclipart.com/library-index/'));
      for (const target of expected) assert.ok(pages.includes(`https://ultraclipart.com${target}`));
      report.sitemapChain = true;
    }
    await nojs.close();
  } catch (error) {
    report.errors.push({ engine, message: error.message });
  } finally {
    await browser.close();
  }
}
report.finished = new Date().toISOString();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
assert.deepEqual(report.errors, []);
