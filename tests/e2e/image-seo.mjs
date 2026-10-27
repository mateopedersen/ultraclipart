import { chromium, webkit, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw Error('Local audit only.');
const art = JSON.parse(readFileSync('data/art.json'));
const fixture = art.find((a) => a.id === 'glove-clipart-rubber-cleaning-gloves');
const out = 'reports/image-seo/browser';
mkdirSync(out, { recursive: true });
const report = { started: new Date().toISOString(), states: [], interactions: [], errors: [] };
const routes = [
  '/',
  '/categories/',
  '/collections/',
  '/library-index/',
  '/clipart/baby/',
  '/clipart/glove/',
  '/clipart/candy/',
  '/art/elephant-clay-miniature-clipart/',
  `/art/${fixture.id}/`,
  '/guides/',
  '/guides/make-a-classroom-label/',
  '/about/',
  '/privacy/',
  '/editorial-process/',
  '/search/?q=yellow%20rubber%20cleaning%20gloves',
  '/favorites/',
];
for (const [engine, implementation] of Object.entries({ chromium, webkit })) {
  const browser = await implementation.launch();
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: width === 390,
        isMobile: width === 390,
        deviceScaleFactor: width === 390 ? 2 : 1,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      const runtimeErrors = [];
      page.on('pageerror', (e) =>
        runtimeErrors.push({ url: page.url(), message: e.message, stack: e.stack }),
      );
      for (const route of routes) {
        try {
          const response = await page.goto(base + route, { waitUntil: 'domcontentloaded' });
          assert.equal(response.status(), 200);
          await page.waitForLoadState('load');
          if (route.startsWith('/search/')) {
            await expect(page.locator('#search-results .art-card').first()).toHaveAttribute(
              'data-id',
              fixture.id,
            );
            await expect(page.locator('#site-search-status')).toBeHidden();
          }
          const state = await page.evaluate(() => {
            const nodes = [],
              visit = (v) => {
                if (Array.isArray(v)) v.forEach(visit);
                else if (v && typeof v === 'object') {
                  if ([v['@type']].flat().includes('ImageObject')) nodes.push(v);
                  Object.values(v).forEach(visit);
                }
              };
            document
              .querySelectorAll('script[type="application/ld+json"]')
              .forEach((s) => visit(JSON.parse(s.textContent)));
            const generated = document.querySelector('#catalog-image-metadata');
            const indexable = !/noindex|none/.test(
              document.querySelector('meta[name="robots"]').content,
            );
            const images = [...document.images].filter(
              (img) => img.alt.trim() && new URL(img.src).pathname.startsWith('/previews/p1/'),
            );
            const missing = images.filter(
              (img) =>
                !nodes.some(
                  (node) =>
                    node.contentUrl ===
                      new URL(new URL(img.src).pathname, 'https://ultraclipart.com').href &&
                    node.creator?.name === 'UltraClipart' &&
                    node.copyrightNotice?.includes('third-party rights') &&
                    node.license === 'https://ultraclipart.com/license/',
                ),
            );
            return {
              indexable,
              schemas: nodes.length,
              images: images.length,
              missing: missing.map((img) => img.src),
              generated: !!generated,
              horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
              canonical: document.querySelector('link[rel="canonical"]').href,
            };
          });
          if (state.indexable) {
            assert.deepEqual(state.missing, [], route);
            assert.ok(state.schemas > 0, route);
          } else assert.equal(state.generated, false, route);
          assert.equal(state.horizontalOverflow, false, route);
          if (route.includes(fixture.id)) {
            const preview = page.locator('#art-preview img');
            await expect(preview).toHaveAttribute('alt', fixture.alt);
            await expect(preview).toHaveAttribute('title', fixture.title);
            await expect(page.locator('h1')).toHaveText(fixture.title);
            await expect(preview).toHaveJSProperty('complete', true);
            assert.ok(await preview.evaluate((img) => img.naturalWidth > 0));
          }
          if (['/', '/clipart/candy/', `/art/${fixture.id}/`].includes(route)) {
            const name =
              route === '/' ? 'home' : route.startsWith('/art/') ? 'artwork' : 'collection';
            await page.screenshot({
              path: `${out}/${engine}-${width}-${name}.png`,
              fullPage: false,
            });
          }
          report.states.push({ engine, width, route, ...state, passed: true });
        } catch (error) {
          report.errors.push({ engine, width, route, message: error.message });
        }
      }
      if (width === 390) {
        try {
          await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
          const choice = page.locator('[data-cookie-choice="necessary"]:visible').first();
          if (await choice.count()) await choice.click();
          await expect(page.locator('form:has(#search-q)')).toHaveAttribute(
            'data-suggestions-ready',
            'true',
          );
          await page.locator('#search-q').fill('yellow rubber cleaning gloves');
          const suggestion = page.locator(`.search-suggestions a[href="/art/${fixture.id}/"]`);
          await expect(suggestion.locator('img')).toHaveAttribute('alt', fixture.alt);
          await suggestion.tap();
          await page.waitForURL(`**/art/${fixture.id}/`);
          await expect(page.locator('h1')).toHaveText(fixture.title);
          report.interactions.push({
            engine,
            check: 'Mobile search finds and opens updated artwork',
            passed: true,
          });
          const original = await context.request.get(base + fixture.webp);
          assert.equal(original.status(), 200);
          assert.ok(original.headers()['content-type'].includes('image/webp'));
          assert.equal(
            createHash('sha256')
              .update(await original.body())
              .digest('hex'),
            fixture.files.webp.sha256,
          );
          report.interactions.push({
            engine,
            check: 'Original download bytes and SHA-256 unchanged',
            passed: true,
          });
        } catch (error) {
          report.errors.push({ engine, width, message: error.message });
        }
      }
      assert.deepEqual(runtimeErrors, []);
      await context.close();
    }
    const noJs = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const page = await noJs.newPage();
    for (const route of ['/', `/art/${fixture.id}/`]) {
      await page.goto(base + route);
      assert.ok(await page.locator('script#catalog-image-metadata').count());
      await expect(page.locator('main')).toBeVisible();
      report.interactions.push({
        engine,
        route,
        check: 'Image metadata and navigation rendered without JavaScript',
        passed: true,
      });
    }
    await noJs.close();
  } catch (error) {
    report.errors.push({ engine, message: error.message });
  } finally {
    await browser.close();
  }
}
report.finished = new Date().toISOString();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    states: report.states.length,
    interactions: report.interactions.length,
    errors: report.errors.length,
  }),
);
assert.deepEqual(report.errors, []);
