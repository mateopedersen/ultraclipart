import { chromium, webkit, firefox, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { inspectLayout } from '../helpers/layout-audit.mjs';
import sharp from 'sharp';
const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Local only');
const out = process.env.EVIDENCE_DIR || 'reports/not-found/final';
const visual = JSON.parse(
  readFileSync(new URL('../../data/not-found-visual.json', import.meta.url)),
);
mkdirSync(out, { recursive: true });
const report = {
  started: new Date().toISOString(),
  scope:
    'Local compiled 404: Chromium/WebKit, nine widths, recovery links, search, touch emulation and accessibility. No physical-device or live deployment test.',
  states: [],
  checks: [],
  failures: [],
};
const engines = process.env.UC_BROWSER
  ? { [process.env.UC_BROWSER]: { chromium, webkit, firefox }[process.env.UC_BROWSER] }
  : { chromium, webkit };
for (const [engine, launcher] of Object.entries(engines)) {
  assert.ok(launcher, 'Supported browser engine required');
  const browser = await launcher.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    for (const path of ['/__404-preview__/', '/missing/nested/illustration/?q=not-a-route']) {
      const response = await page.goto(base + path);
      assert.equal(response.status(), 404);
      await expect(page.locator('h1')).toHaveText('That page is missing.');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.locator('.nf-scene-image')).toHaveAttribute('alt', visual.alt);
      await expect(page.locator('.nf-scene-image')).toHaveAttribute('title', visual.title);
      await expect(page.locator('.nf-scene-image')).toHaveAttribute('src', visual.src);
      assert.equal((await page.request.head(base + path)).status(), 404);
    }
    const consent = page.locator('[data-cookie-choice="necessary"]:visible').first();
    if (await consent.count()) await consent.click();
    for (const image of await page.locator('.not-found img').all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((img) => img.decode());
    }
    const ids = await page.locator('[id]').evaluateAll((nodes) => nodes.map((node) => node.id));
    assert.equal(ids.length, new Set(ids).size);
    for (const width of [320, 360, 390, 414, 600, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => scrollTo(0, 0));
      const layout = await page.evaluate(inspectLayout);
      assert.equal(layout.horizontalOverflow, false, `${width}: horizontal overflow`);
      assert.deepEqual(layout.clipped, [], `${width}: clipped text`);
      assert.deepEqual(layout.escaped, [], `${width}: escaped content`);
      const heights = await page
        .locator('.nf-subject')
        .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
      assert.ok(Math.max(...heights) - Math.min(...heights) < 2, 'equal subject cards');
      const scan = await new AxeBuilder({ page })
        .include('.not-found')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      assert.deepEqual(
        scan.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, reason: n.failureSummary })),
        })),
        [],
        `${width}: accessibility`,
      );
      if ([390, 1440].includes(width)) {
        await page.locator('.footer-invitation').scrollIntoViewIfNeeded();
        for (const img of await page.locator('.footer-invitation img').all()) {
          await img.scrollIntoViewIfNeeded();
          await img.evaluate((img) => img.decode());
        }
        const bytes = await page.locator('.footer-invitation-copy').screenshot({
          path: `${out}/${engine}-footer-copy-${width}.png`,
          mask: [page.locator('.footer-invitation-copy img')],
          maskColor: '#ffffff',
        });
        const { data } = await sharp(bytes)
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        let corrupted = 0;
        for (let i = 0; i < data.length; i += 3)
          if (
            data[i] > 140 &&
            data[i + 1] > 140 &&
            data[i + 2] < Math.min(data[i], data[i + 1]) * 0.65
          )
            corrupted++;
        assert.ok(
          corrupted < 10,
          `${engine}/${width}: unexpected yellow noise in blue/white footer copy (${corrupted} pixels)`,
        );
        await page.evaluate(() => scrollTo(0, 0));
      }
      if ([320, 390, 768, 1440].includes(width))
        await page.screenshot({ path: `${out}/${engine}-${width}.png`, fullPage: true });
      if (width === 1440) {
        await page.locator('.nf-hero').screenshot({ path: `${out}/${engine}-hero.png` });
        await page.locator('.not-found').screenshot({ path: `${out}/${engine}-page.png` });
      }
      report.states.push({ engine, width, status: 404, passed: true, accessibilityViolations: 0 });
    }
    report.checks.push({
      engine,
      check:
        'Footer background rendered without yellow corruption at 390/1440; legitimate illustration colors were masked',
      passed: true,
    });
    const targets = await page
      .locator('.not-found a[href^="/"]')
      .evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute('href')))]);
    for (const href of targets)
      assert.equal((await page.request.get(base + href)).status(), 200, href);
    report.checks.push({
      engine,
      check:
        'Actual missing/deep routes and HEAD return 404; noindex retained; all recovery destinations return 200',
      targets: targets.length,
      passed: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.locator('.nf-search')).toHaveAttribute('data-suggestions-ready', 'true');
    await page.locator('#nf-query').fill('baby pumpkin costume');
    const suggestion = page.locator(
      '.nf-search .search-suggestions a[href="/art/baby-pumpkin-costume-clipart/"]',
    );
    await expect(suggestion).toBeVisible();
    await suggestion.click();
    await expect(page).toHaveURL(base + '/art/baby-pumpkin-costume-clipart/');
    report.checks.push({
      engine,
      check: 'Search suggestion on a real 404 navigates to the matching artwork',
      passed: true,
    });
    await page.goto(base + '/__404-preview__/');
    await page.locator('.nf-home').click();
    await expect(page).toHaveURL(base + '/');
    report.checks.push({ engine, check: 'Homepage recovery link works', passed: true });
    const touchContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const touch = await touchContext.newPage();
      assert.equal((await touch.goto(base + '/__404-preview__/')).status(), 404);
      await touch.locator('#nf-query').fill('baby pumpkin costume');
      const touchSuggestion = touch.locator(
        '.nf-search .search-suggestions a[href="/art/baby-pumpkin-costume-clipart/"]',
      );
      await expect(touchSuggestion).toBeVisible();
      await touchSuggestion.tap();
      await expect(touch).toHaveURL(base + '/art/baby-pumpkin-costume-clipart/');
      await touch.goto(base + '/__404-preview__/');
      const artwork = touch.locator('.nf-subject').first();
      const destination = await artwork.getAttribute('href');
      await artwork.tap();
      await expect(touch).toHaveURL(base + destination);
      report.checks.push({
        engine,
        check: '390px touch emulation: search suggestion and illustrated subject links navigate',
        passed: true,
      });
    } finally {
      await touchContext.close();
    }
    const plainContext = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    try {
      const plain = await plainContext.newPage();
      assert.equal((await plain.goto(base + '/missing/no-script/')).status(), 404);
      await plain.locator('#nf-query').fill('watercolor fox');
      await plain.locator('.nf-search button').click();
      await expect(plain).toHaveURL(base + '/search/?q=watercolor+fox');
      await plain.goto(base + '/__404-preview__/');
      await plain.locator('.nf-subject').first().click();
      await expect(plain).toHaveURL(base + '/collection/animals-nature/');
      report.checks.push({
        engine,
        check: 'Native form and subject navigation work without JavaScript',
        passed: true,
      });
    } finally {
      await plainContext.close();
    }
    assert.deepEqual(errors, []);
  } catch (error) {
    report.failures.push({ engine, error: error.stack, pageErrors: errors });
    await page.screenshot({ path: `${out}/${engine}-failure.png`, fullPage: true }).catch(() => {});
  } finally {
    await context.close();
    await browser.close();
  }
}
report.finished = new Date().toISOString();
writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
assert.deepEqual(report.failures, []);
