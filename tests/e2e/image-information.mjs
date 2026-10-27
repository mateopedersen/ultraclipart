import { chromium, webkit, firefox, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Local only');
const out = process.env.EVIDENCE_DIR || 'reports/image-information/browser';
mkdirSync(out, { recursive: true });
const catalog = JSON.parse(readFileSync('data/art.json'));
const sample = catalog.find((a) => a.id === 'apple-beaded-clipart');
const report = { started: new Date().toISOString(), checks: [], failures: [] };
const engines = process.env.UC_BROWSER
  ? { [process.env.UC_BROWSER]: { chromium, webkit, firefox }[process.env.UC_BROWSER] }
  : { chromium, webkit };
for (const [engine, launcher] of Object.entries(engines)) {
  const browser = await launcher.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const tip = page.locator('[data-image-information]');
  const record = (name) => report.checks.push({ engine, name, passed: true });
  async function hover(image) {
    const before = await image.evaluate((img) => ({ title: img.title, alt: img.alt }));
    await image.hover();
    await expect(tip).toBeVisible();
    await expect(tip.locator('strong')).toHaveText(before.title || 'Image description');
    await expect(tip.locator('p')).toHaveText(before.alt);
    assert.equal(await image.getAttribute('alt'), before.alt);
    return before;
  }
  try {
    await page.goto(base + '/');
    const consent = page.locator('[data-cookie-choice="necessary"]:visible').first();
    if (await consent.count()) await consent.click();
    const first = page.locator('.home-sample img').first();
    const metadata = await hover(first);
    await page.screenshot({ path: `${out}/${engine}-home-tooltip.png` });
    await tip.hover();
    await page.waitForTimeout(500); // Verify that the actual hoverable panel persists.
    await expect(tip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();
    await expect(first).toHaveAttribute('title', metadata.title);
    record('Home: exact image title/alt; hoverable popup; Escape restores native metadata');
    await hover(page.locator('.home-sample img').nth(1));
    const target = await page.locator('.home-sample').nth(1).getAttribute('href');
    await page.locator('.home-sample').nth(1).click();
    await expect(page).toHaveURL(base + target);
    record('A different image has its own description and click navigation still works');
    await page.goto(base + '/art/' + sample.id + '/');
    const preview = page.locator('#art-preview img');
    await expect(preview).toHaveAttribute('alt', sample.alt);
    await expect(preview).toHaveAttribute('title', sample.title);
    await hover(preview);
    await page.screenshot({ path: `${out}/${engine}-detail-tooltip.png` });
    const bounds = await tip.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 1440);
    await page.keyboard.press('Escape');
    await expect(preview).toHaveAttribute('title', sample.title);
    record('Detail: image-specific metadata and viewport-contained popup');
    await page
      .locator(`[data-download-open="${sample.id}"][data-download-format="webp"]`)
      .first()
      .click();
    const dialog = page.locator('#download-dialog');
    await expect(dialog).toBeVisible();
    await hover(page.locator('[data-download-preview]'));
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    record('Download dialog: top-layer popup; first Escape closes only image information');
    await page.goto(base + '/search/?q=baby%20pumpkin%20costume');
    const result = page.locator('#search-results .art-card .art-picture img').first();
    await expect(result).toBeVisible();
    await hover(result);
    await page.keyboard.press('Escape');
    record('Dynamically rendered search results use their own metadata without reinitialization');
    await page.evaluate((item) => {
      const a = document.createElement('a');
      a.href = '/art/' + item.id + '/';
      a.dataset.testFutureImage = '';
      const img = document.createElement('img');
      img.src = item.thumb;
      img.alt = item.alt;
      img.title = item.title;
      img.width = 180;
      img.height = 180;
      a.append(img);
      document.querySelector('main').prepend(a);
    }, sample);
    const added = page.locator('[data-test-future-image] img');
    await hover(added);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await page.locator('[data-test-future-image]').focus();
    await expect(tip).toBeVisible();
    await expect(tip.locator('p')).toHaveText(sample.alt);
    await page.keyboard.press('Escape');
    record('A newly inserted image works automatically; keyboard focus and dismissal work');
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: engine !== 'firefox',
    });
    try {
      const p = await mobile.newPage();
      await p.goto(base + '/');
      const link = p.locator('.home-sample').first(),
        href = await link.getAttribute('href');
      await link.tap();
      await expect(p).toHaveURL(base + href);
      await expect(p.locator('[data-image-information]')).toBeHidden();
      record('Mobile touch navigation is preserved without a hover popup');
    } finally {
      await mobile.close();
    }
    const nojs = await browser.newContext({ javaScriptEnabled: false });
    try {
      const p = await nojs.newPage();
      await p.goto(base + '/art/' + sample.id + '/');
      await expect(p.locator('#art-preview img')).toHaveAttribute('alt', sample.alt);
      await expect(p.locator('#art-preview img')).toHaveAttribute('title', sample.title);
      record('SEO metadata remains in original HTML and native no-JavaScript fallback');
    } finally {
      await nojs.close();
    }
    assert.deepEqual(errors, []);
  } catch (error) {
    report.failures.push({ engine, error: error.stack, pageErrors: errors });
    await page.screenshot({ path: `${out}/${engine}-failure.png` }).catch(() => {});
  } finally {
    await context.close();
    await browser.close();
  }
}
report.finished = new Date().toISOString();
writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
assert.deepEqual(report.failures, []);
