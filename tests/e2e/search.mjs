import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tokenBucket } from '../../src/lib/search-index.ts';
const catalog = JSON.parse(readFileSync(new URL('../../data/art.json', import.meta.url)));
const pumpkinCount = catalog.filter(
  (x) =>
    x.topic === 'pumpkin' ||
    ['volleyball-halloween-pumpkin-clipart', 'baby-pumpkin-costume-clipart'].includes(x.id),
).length;
const giftCount = catalog.filter((x) =>
  /\bgift\b/i.test([x.topic, x.title, x.description, x.alt].join(' ')),
).length;
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4322';
const engine = process.env.UC_BROWSER ?? 'chromium';
const browser = await { chromium, firefox, webkit }[engine].launch({
  headless: true,
  ...(engine === 'chromium' && process.env.CHROMIUM_BIN
    ? { executablePath: process.env.CHROMIUM_BIN }
    : {}),
});
const evidence = resolve(engine === 'chromium' ? 'reports/search' : `reports/search/${engine}`);
mkdirSync(evidence, { recursive: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
  page = await context.newPage(),
  errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const report = { base, browser: engine, checks: [], accessibility: [], errors };
const cards = () => page.locator('#search-results:not([hidden]) .art-card');
const ready = () => expect(page.locator('#search-results')).toHaveAttribute('aria-busy', 'false');
try {
  const response = await page.goto(`${base}/search/?q=pumpkin`);
  const html = await response.text();
  assert.equal(
    (html.match(/class="art-card"/g) ?? []).length,
    8,
    'initial HTML is capped at eight cards',
  );
  await expect(page.locator('#result-count')).toHaveText(
    `${pumpkinCount} illustrations for “pumpkin”`,
  );
  await expect(cards()).toHaveCount(pumpkinCount);
  report.checks.push('subject search, eight-card HTML cap');
  await page.selectOption('#filter-style', 'outline');
  await expect(cards()).toHaveCount(1);
  await expect(cards()).toHaveAttribute('data-id', 'pumpkin-botanical-outline');
  report.checks.push('real outline filter');
  await page.selectOption('#filter-orientation', 'portrait');
  await expect(page.locator('#search-empty')).toBeVisible();
  report.checks.push('honest empty facet');
  await page.click('#clear-filters');
  await expect(cards()).toHaveCount(pumpkinCount);
  await page.fill('#search-query', '');
  await page.locator('#catalog-search button').click();
  await expect(cards()).toHaveCount(8);
  await page.click('#next-page');
  await expect(cards()).toHaveCount(Math.min(8, catalog.length - 8));
  assert.ok(page.url().includes('page=2'));
  report.checks.push('pagination and URL');
  await page.goBack();
  await expect(page.locator('#page-position')).toHaveText(
    `Page 1 of ${Math.ceil(catalog.length / 8)}`,
  );
  await expect(cards()).toHaveCount(8);
  report.checks.push('browser history');
  await page.selectOption('#search-sort', 'title');
  await ready();
  assert.ok(page.url().includes('sort=title'));
  report.checks.push('sorting');
  await page.fill('#search-query', '<script>alert(1)</script>');
  await page.locator('#catalog-search button').click();
  await expect(page.locator('#search-empty')).toBeVisible();
  assert.equal(await page.locator('#result-count script').count(), 0);
  report.checks.push('query rendered as text');
  await page.fill('#search-query', 'black and white pumpkin');
  await page.locator('#catalog-search button').click();
  await expect(cards()).toHaveCount(1);
  await page.screenshot({ path: resolve(evidence, 'desktop.png'), fullPage: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `overflow at ${width}px`,
    );
    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    report.accessibility.push({
      width,
      violations: scan.violations.map((item) => ({
        id: item.id,
        impact: item.impact,
        nodes: item.nodes.map((node) => node.target),
      })),
    });
  }
  await page.screenshot({ path: resolve(evidence, 'mobile-320.png'), fullPage: true });
  // Fail a cold manifest request, then retry through the visible control.
  await page.route('**/search-data/**', (route) => route.abort('failed'));
  await page.goto(`${base}/search/?q=ghost`);
  await expect(page.locator('#search-error')).toBeVisible();
  await expect(page.locator('#result-count')).toHaveText('Search is temporarily unavailable.');
  await page.unroute('**/search-data/**');
  await page.click('#search-retry');
  await expect(cards()).toHaveCount(1);
  await expect(cards()).toHaveAttribute('data-id', 'ghost-teacup');
  report.checks.push('network error and visible retry recovery');
  // Hold an old query's network request while a newer query completes.
  let release, started;
  const gate = new Promise((resolve) => (release = resolve)),
    seen = new Promise((resolve) => (started = resolve));
  const slow = `**/tokens/${tokenBucket('pumpkin')}.json`;
  await page.route(slow, async (route) => {
    started();
    await gate;
    await route.continue().catch(() => {});
  });
  await page.fill('#search-query', 'pumpkin');
  await page.locator('#catalog-search button').click();
  await seen;
  await page.fill('#search-query', 'gift');
  await page.locator('#catalog-search button').click();
  await expect(cards()).toHaveCount(giftCount);
  await expect(
    cards().filter({ has: page.locator('[href="/art/gift-ribbon-keepsake/"]') }),
  ).toHaveCount(1);
  release();
  await page.unroute(slow);
  await expect(page.locator('#result-count')).toHaveText(
    `${giftCount} ${giftCount === 1 ? 'illustration' : 'illustrations'} for “gift”`,
  );
  report.checks.push('outdated request cannot overwrite newer results');
  // Favorites have no catalog cards in HTML and fetch only the saved IDs.
  await page.evaluate(() =>
    localStorage.setItem(
      'ultraclipart-favorites',
      JSON.stringify(['ghost-teacup', 'gift-ribbon-keepsake']),
    ),
  );
  const requested = [];
  const listener = (request) => {
    if (request.url().includes('/search-data/')) requested.push(request.url());
  };
  page.on('request', listener);
  const favorites = await page.goto(`${base}/favorites/`);
  assert.equal((await favorites.text()).includes('class="art-card"'), false);
  await expect(page.locator('#favorites .art-card')).toHaveCount(2);
  assert.deepEqual(
    requested
      .filter((url) => url.includes('/items/'))
      .map((url) => url.split('/').at(-1))
      .sort(),
    ['ghost-teacup.json', 'gift-ribbon-keepsake.json'],
  );
  assert.equal(
    requested.some((url) => /\/(tokens|ranked|lexicon)\//.test(url)),
    false,
  );
  page.off('request', listener);
  report.checks.push('favorites fetch only saved ID metadata');
  // Deliberately cold/delayed data exposes loading-related layout shifts.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    window.__searchCLS = PerformanceObserver.supportedEntryTypes.includes('layout-shift')
      ? 0
      : null;
    if (window.__searchCLS !== null)
      new PerformanceObserver((list) => {
        for (const item of list.getEntries())
          if (!item.hadRecentInput) window.__searchCLS += item.value;
      }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.route('**/search-data/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 180));
    await route.continue();
  });
  await page.goto(`${base}/search/?q=pumpkin`);
  await expect(cards()).toHaveCount(pumpkinCount);
  await page.waitForLoadState('networkidle');
  report.delayedColdQueryCLS = await page.evaluate(() => window.__searchCLS);
  if (report.delayedColdQueryCLS !== null) {
    assert.ok(report.delayedColdQueryCLS < 0.02, `Cold query CLS ${report.delayedColdQueryCLS}`);
    report.checks.push('delayed cold query CLS below 0.02');
  } else report.layoutShiftObserver = 'Unavailable in this engine';
  assert.equal(errors.length, 0, 'browser errors');
  report.status = report.accessibility.some((result) => result.violations.length)
    ? 'accessibility-issues'
    : 'passed';
  writeFileSync(resolve(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  assert.equal(report.status, 'passed');
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  await page.screenshot({ path: resolve(evidence, 'failure.png'), fullPage: true });
  writeFileSync(resolve(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  throw error;
} finally {
  await browser.close();
}
