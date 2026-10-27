import { chromium, webkit, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local audit only');
const out = process.env.CATALOG_DELIVERY_OUT || 'reports/performance/catalog-delivery';
mkdirSync(out, { recursive: true });
const report = [];
for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base + '/create/?view=page');
    const images = page.locator('.studio-scene-preview img');
    await expect(images).toHaveCount(18);
    for (const image of await images.all()) {
      await expect(image).toHaveAttribute('loading', 'lazy');
      assert.ok((await image.getAttribute('title'))?.trim());
      assert.equal(await image.getAttribute('alt'), await image.getAttribute('title'));
      await expect(image).toHaveAttribute('src', /^\/studio-previews\/.+-[a-f0-9]{16}\.svg$/);
      const response = await page.request.get(new URL(await image.getAttribute('src'), base).href);
      assert.equal(response.status(), 200);
      assert.match(response.headers()['content-type'], /image\/svg\+xml/);
      const svg = await response.text();
      assert.ok(svg.includes('data:image/webp;base64,'));
      assert.doesNotMatch(svg, /<script|(?:href|src)=["']https?:/i);
    }
    await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true', {
      timeout: 60000,
    });
    if ((await page.locator('[data-wb-back-page]').getAttribute('aria-pressed')) === 'true')
      await page.locator('[data-wb-back-page]').click();
    while (await page.locator('[data-scene-more]').isVisible())
      await page.locator('[data-scene-more]').click();
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() => image.evaluate((node) => node.complete && node.naturalWidth === 1400))
        .toBe(true);
    }
    await page.locator('#studio-scene-grid').screenshot({ path: `${out}/${engine}-previews.png` });
    await page.goto(base + '/categories/');
    await expect(page.locator('#discovery-controls')).toHaveAttribute('data-ready', 'true');
    const total = await page.locator('#subject-grid [data-topic]').count();
    assert.ok(total > 200);
    assert.equal(await page.locator('#subject-grid [data-topic]:visible').count(), 12);
    await page.locator('#topic-filter').fill('baby');
    await expect(page.locator('#subject-grid [data-topic]:visible a').first()).toHaveAttribute(
      'href',
      '/clipart/baby/',
    );
    const nojs = await browser.newPage({ javaScriptEnabled: false });
    await nojs.goto(base + '/categories/');
    assert.equal(await nojs.locator('#subject-grid [data-topic]:visible').count(), total);
    assert.deepEqual(errors, []);
    report.push({
      engine,
      previews: 18,
      decoded: true,
      subjects: total,
      initialSubjects: 12,
      search: true,
      withoutJavaScriptSubjects: total,
      errors,
    });
  } finally {
    await browser.close();
  }
}
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
