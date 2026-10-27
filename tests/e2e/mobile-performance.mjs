import { chromium, webkit, firefox, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Local only');
const out = process.env.EVIDENCE_DIR || 'reports/performance/mobile-behavior';
mkdirSync(out, { recursive: true });
const catalog = JSON.parse(readFileSync(new URL('../../data/art.json', import.meta.url)));
const item = catalog.find((a) => a.id === 'classic-white-volleyball-realistic-clipart');
const report = { started: new Date().toISOString(), checks: [], failures: [] };
const engines = process.env.UC_BROWSER
  ? { [process.env.UC_BROWSER]: { chromium, webkit, firefox }[process.env.UC_BROWSER] }
  : { chromium, webkit };
for (const [engine, implementation] of Object.entries(engines)) {
  const browser = await implementation.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: engine !== 'firefox',
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const record = (name, data = {}) => report.checks.push({ engine, name, ...data, passed: true });
  let releaseOriginal, releaseDirectory;
  try {
    await page.route('**/api/cookie-region.json', (route) =>
      route.fulfill({ contentType: 'application/json', body: '{"showNotice":false}' }),
    );
    const originalGate = new Promise((resolve) => {
      releaseOriginal = resolve;
    });
    await page.route(`**${item.webp}`, async (route) => {
      await originalGate;
      await route.continue();
    });
    await page.goto(base + `/edit/${item.id}/`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-editor-preview] image')).toBeVisible();
    await expect(page.locator('.uc-workspace')).toHaveAttribute('inert', '');
    await page.evaluate(() => {
      window.initialCanvasImage = document.querySelector('[data-editor-preview] image');
    });
    await page.locator('.uc-stage').screenshot({ path: `${out}/${engine}-waiting-original.png` });
    record('Artwork visible while original verification is pending; controls stay locked');
    releaseOriginal();
    await expect(page.locator('.uc-workspace')).not.toHaveAttribute('inert', '', {
      timeout: 30000,
    });
    await expect(page.locator('.uc-editor')).not.toHaveAttribute('data-processing', 'true');
    assert.equal(
      await page.evaluate(
        () => window.initialCanvasImage === document.querySelector('[data-artwork-canvas] image'),
      ),
      true,
    );
    await expect(page.locator('[data-artwork-canvas] image')).toHaveAttribute(
      'href',
      /^\/previews\/p1\//,
    );
    await page.locator('.uc-stage').screenshot({ path: `${out}/${engine}-ready.png` });
    record('Verified editor preserves the already painted preview node');
    for (let i = 0; i < 4; i++) await page.locator('[data-action="zoom-in"]').click();
    await expect(page.locator('[data-artwork-canvas] image')).toHaveAttribute(
      'href',
      /^data:image\/webp;base64,/,
    );
    const hash = await page.locator('[data-artwork-canvas] image').evaluate(async (image) => {
      const raw = atob(image.getAttribute('href').split(',')[1]);
      const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('');
    });
    assert.equal(hash, item.files.webp.sha256);
    await page.locator('[data-action="fit"]').click();
    await expect(page.locator('[data-artwork-canvas] image')).toHaveAttribute(
      'href',
      /^\/previews\/p1\//,
    );
    record('Zoom switches to the exact original SHA-256; fit returns to screen copy');
    const directoryGate = new Promise((resolve) => {
      releaseDirectory = resolve;
    });
    await page.route('**/search-data/*/site.json', async (route) => {
      await directoryGate;
      await route.continue();
    });
    await page.goto(base + '/search/?q=baby', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#search-results .art-card').first()).toBeVisible();
    await expect(page.locator('#site-search-status')).toContainText('Finding');
    await page.evaluate(() => {
      window.firstSearchCard = document.querySelector('#search-results .art-card');
    });
    releaseDirectory();
    await expect(page.locator('#site-search-status')).toBeHidden();
    assert.equal(
      await page.evaluate(
        () => window.firstSearchCard === document.querySelector('#search-results .art-card'),
      ),
      true,
    );
    record('Artwork arrives before slow directory; directory arrival keeps artwork nodes');
    await page.unroute('**/search-data/*/site.json');
    await page.route('**/search-data/*/site.json', (route) => route.abort());
    await page.goto(base + '/search/?q=volleyball', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#search-results .art-card').first()).toBeVisible();
    await expect(page.locator('#site-search-retry')).toBeVisible();
    await page.unroute('**/search-data/*/site.json');
    await page.locator('#site-search-retry').click();
    await expect(page.locator('#site-search-retry')).toBeHidden();
    await expect(page.locator('#result-count')).toContainText('volleyball');
    const link = page.locator('#search-results .art-card .art-picture').first();
    const target = await link.getAttribute('href');
    await link.tap();
    await page.waitForURL(base + target);
    record('Directory failure preserves artwork; retry and mobile result navigation work');
    // Use a fresh context: WebKit can reuse an already decoded SVG image without
    // a network request, which would not exercise an unavailable derivative.
    const missingContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const missingPage = await missingContext.newPage();
      let blockedCopies = 0;
      await missingPage.route('**/previews/p1/*-960.webp', (route) => {
        blockedCopies++;
        return route.abort();
      });
      await missingPage.goto(base + `/edit/${item.id}/`);
      await expect(missingPage.locator('.uc-workspace')).not.toHaveAttribute('inert', '', {
        timeout: 30000,
      });
      await expect(missingPage.locator('[data-artwork-canvas] image')).toHaveAttribute(
        'href',
        /^data:image\/webp;base64,/,
      );
      assert.ok(blockedCopies > 0, 'the absent derivative must actually be requested and blocked');
    } finally {
      await missingContext.close();
    }
    record('Unavailable display copy falls back to the verified original');
    const studioRequests = [];
    page.on('request', (request) => studioRequests.push(request.url()));
    await page.goto(base + '/create/', { waitUntil: 'domcontentloaded' });
    const offscreen = await page
      .locator('.uc-editor')
      .evaluate((root) => root.getBoundingClientRect().top > innerHeight + 300);
    if (offscreen)
      assert.equal(
        studioRequests.some((url) => url.endsWith('/studio-featured.json')),
        false,
      );
    await page.locator('[data-studio-launch="text"]').first().click();
    await expect(page.locator('.uc-workspace')).not.toHaveAttribute('inert', '', {
      timeout: 30000,
    });
    await expect(page.locator('#uc-tool-text')).toHaveAttribute('aria-pressed', 'true');
    record('Offscreen Studio defers its library and first launcher click opens Text', {
      offscreen,
    });
    await page.goto(base + '/create/?editor-tool=text');
    await expect(page.locator('.uc-workspace')).not.toHaveAttribute('inert', '', {
      timeout: 30000,
    });
    await expect(page.locator('#uc-tool-text')).toHaveAttribute('aria-pressed', 'true');
    record('Direct Studio tool links initialize without requiring scrolling');
    assert.deepEqual(errors, []);
  } catch (error) {
    report.failures.push({ engine, error: error.stack, pageErrors: errors });
    await page.screenshot({ path: `${out}/${engine}-failure.png` }).catch(() => {});
  } finally {
    releaseOriginal?.();
    releaseDirectory?.();
    await context.close();
    await browser.close();
    writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  }
}
report.finished = new Date().toISOString();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
assert.deepEqual(report.failures, []);
