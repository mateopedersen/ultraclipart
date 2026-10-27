import { chromium, webkit, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { readEditorialCatalog } from '../helpers/editorial-catalog.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4323';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base))
  throw new Error('Local preview only.');
const art = readEditorialCatalog().filter((a) => a.published && a.indexable);
const byId = new Map(art.map((a) => [a.id, a]));
const out = 'reports/collection-seo/image-metadata';
mkdirSync(out, { recursive: true });
const report = { started: new Date().toISOString(), pages: [], interactions: [], failures: [] };
for (const [engine, implementation] of Object.entries({ chromium, webkit })) {
  const browser = await implementation.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  page.setDefaultNavigationTimeout(45000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  async function go(route) {
    const response = await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), route === '/404/' ? 404 : 200, route);
    const cookie = page.locator('[data-cookie-choice="necessary"]:visible').first();
    if (await cookie.count()) await cookie.click();
  }
  async function cardMetadata(selector, idAttribute) {
    const values = await page.locator(selector).evaluateAll(
      (cards, attr) =>
        cards.map((card) => {
          const image = card.querySelector('img');
          return { id: card.getAttribute(attr), alt: image?.alt, title: image?.title };
        }),
      idAttribute,
    );
    assert.ok(values.length > 0, selector);
    for (const value of values) {
      assert.equal(value.alt, byId.get(value.id)?.alt, value.id);
      assert.equal(value.title, byId.get(value.id)?.title, value.id);
    }
  }
  try {
    const representatives = [...new Map(art.map((a) => [a.topic, a.id])).values()];
    const routes = [
      '/',
      '/categories/',
      '/collections/',
      '/new/',
      '/black-and-white/',
      '/about/',
      '/for-teachers/',
      '/guides/',
      '/guides/make-a-classroom-label/',
      '/guides/turn-clipart-into-a-coloring-activity/',
      '/guides/webp-pdf-and-editable-projects/',
      '/create/',
      '/ai-clipart-generator/',
      '/accessibility/',
      '/privacy/',
      '/terms/',
      '/license/',
      '/faq/',
      '/editorial-process/',
      '/copyright/',
    ];
    // One actual detail route per subject, plus each distinct static image renderer.
    for (const route of [...routes, ...representatives.map((id) => `/art/${id}/`)]) {
      await go(route);
      const missing = await page
        .locator('img[alt]:not([alt=""])')
        .evaluateAll((images) =>
          images.filter((img) => !img.title.trim()).map((img) => img.getAttribute('src')),
        );
      assert.deepEqual(missing, [], route);
      if (route.startsWith('/art/')) {
        const source = byId.get(route.split('/')[2]);
        await expect(page.locator('#art-preview img')).toHaveAttribute('alt', source.alt);
        await expect(page.locator('#art-preview img')).toHaveAttribute('title', source.title);
        await cardMetadata('.related-card', 'data-related-id');
      }
      report.pages.push({ engine, route, passed: true });
      if (report.pages.length % 50 === 0)
        console.log(`${engine}: ${report.pages.length} metadata pages checked`);
    }
    await go('/clipart/baby/');
    await page.locator('[data-related-collections] a[href="/clipart/mom/"]').tap();
    await page.waitForURL('**/clipart/mom/');
    report.interactions.push({
      engine,
      check: 'Related collection touch navigation',
      passed: true,
    });
    await go('/');
    await expect(page.locator('form:has(#search-q)')).toHaveAttribute(
      'data-suggestions-ready',
      'true',
    );
    await page.locator('#search-q').fill('baby pumpkin costume');
    const suggestion = page.locator(
      '.search-suggestions a[href="/art/baby-pumpkin-costume-clipart/"]',
    );
    const baby = byId.get('baby-pumpkin-costume-clipart');
    await expect(suggestion.locator('img')).toHaveAttribute('alt', baby.alt);
    await expect(suggestion.locator('img')).toHaveAttribute('title', baby.title);
    await suggestion.tap();
    await page.waitForURL('**/art/baby-pumpkin-costume-clipart/');
    report.interactions.push({
      engine,
      check: 'Search thumbnail metadata and mobile navigation',
      passed: true,
    });
    await page.locator('[data-related-mode="subject"]').click();
    await cardMetadata('.related-card:visible', 'data-related-id');
    report.interactions.push({
      engine,
      check: 'Rebuilt More like this cards preserve their own metadata',
      passed: true,
    });
    await page
      .locator('[data-download-open="baby-pumpkin-costume-clipart"][data-download-format="webp"]')
      .first()
      .click();
    await expect(page.locator('#download-dialog')).toBeVisible();
    await expect(page.locator('[data-download-preview]')).toHaveAttribute('alt', baby.alt);
    await expect(page.locator('[data-download-preview]')).toHaveAttribute('title', baby.title);
    await page.keyboard.press('Escape');
    report.interactions.push({ engine, check: 'Download lightbox image metadata', passed: true });
    await go('/search/?q=baby%20pumpkin%20costume');
    await expect(page.locator('#search-results .art-card').first()).toHaveAttribute(
      'data-id',
      baby.id,
    );
    await cardMetadata('#search-results .art-card', 'data-id');
    report.interactions.push({
      engine,
      check: 'Dynamic search result image metadata',
      passed: true,
    });
    await go('/create/');
    // Offscreen Studio initialization is intentionally deferred. Open its actual
    // artwork launcher rather than assuming the editor loads before interaction.
    await page.locator('[data-studio-launch="elements"]').first().tap();
    await expect(page.locator('.uc-workspace')).not.toHaveAttribute('inert', '', {
      timeout: 30000,
    });
    await page.locator('#uc-tool-elements').click();
    await expect(page.locator('[data-artwork-grid] img').first()).toHaveAttribute('title', /.+/);
    await cardMetadata('[data-artwork-grid] [data-artwork]', 'data-artwork');
    report.interactions.push({ engine, check: 'Studio artwork library metadata', passed: true });
    await go('/ai-clipart-generator/');
    await page.locator('#ai-ingredient-category-trigger').click();
    const images = await page
      .locator('#ai-choice-dialog img')
      .evaluateAll((items) => items.map((img) => ({ alt: img.alt, title: img.title })));
    assert.ok(images.length > 0);
    assert.ok(images.every((img) => img.alt && img.title));
    await page.keyboard.press('Escape');
    report.interactions.push({
      engine,
      check: 'Builder reference picker metadata without generation',
      passed: true,
    });
    assert.deepEqual(errors, []);
  } catch (error) {
    report.failures.push({ engine, url: page.url(), message: error.message });
  } finally {
    await browser.close();
  }
  console.log(
    `${engine}: ${report.pages.filter((p) => p.engine === engine).length} pages; ${report.interactions.filter((p) => p.engine === engine).length} interactions; ${report.failures.length} failures`,
  );
}
report.finished = new Date().toISOString();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
assert.deepEqual(report.failures, []);
