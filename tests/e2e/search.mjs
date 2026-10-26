import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { checkSearchSuggestions } from '../helpers/search-suggestions-browser.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tokenBucket } from '../../src/lib/search-index.ts';
import { defaults, searchArtwork } from '../../src/lib/search.ts';
const catalog = JSON.parse(readFileSync(new URL('../../data/art.json', import.meta.url)));
const topics = [
  ...JSON.parse(readFileSync(new URL('../../data/topics.json', import.meta.url))).topics,
  ...JSON.parse(readFileSync(new URL('../../data/extra-topics.json', import.meta.url))),
];
const searchable = catalog.map((item) => ({
  ...item,
  cluster: topics.find((topic) => topic.slug === item.topic)?.cluster ?? '',
}));
// Semantic scoring has isolated unit fixtures. Here verify browser integration
// against the current catalog, including pagination and future outline additions.
const expected = (patch) => searchArtwork(searchable, { ...defaults, ...patch });
const pumpkin = expected({ q: 'pumpkin' });
const pumpkinCount = pumpkin.total;
const cardinal = expected({ q: 'cardinal' });
const cardinalCount = cardinal.total;
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
  report.checks.push(...(await checkSearchSuggestions(browser, base, engine)));
  await page.goto(`${base}/search/?q=classroom%20label&type=guide`);
  await expect(
    page.locator('#site-search-results a[href="/guides/make-a-classroom-label/"]'),
  ).toBeVisible();
  await expect(page.locator('#search-results')).toBeHidden();
  report.checks.push('long-tail guide search finds the matching project instructions');
  const response = await page.goto(`${base}/search/?q=pumpkin&type=artwork`);
  const html = await response.text();
  assert.equal(
    (html.match(/class="art-card"/g) ?? []).length,
    8,
    'initial HTML is capped at eight cards',
  );
  await expect(page.locator('#result-count')).toContainText(`${pumpkinCount} artworks`);
  await expect(page.locator('#result-count')).toContainText('for “pumpkin”');
  await expect(cards()).toHaveCount(pumpkin.items.length);
  assert.deepEqual(
    await cards().evaluateAll((nodes) => nodes.map((node) => node.dataset.id)),
    pumpkin.items.map((item) => item.id),
  );
  report.checks.push('subject search, exact ranked identities, eight-card HTML cap');
  await page.selectOption('#filter-style', 'outline');
  const outlines = expected({ q: 'pumpkin', style: 'outline' });
  await expect(cards()).toHaveCount(outlines.items.length);
  await expect(page.locator('#search-empty')).toBeVisible({ visible: outlines.total === 0 });
  report.checks.push('outline filter matches available catalog artwork');
  await page.selectOption('#filter-orientation', 'portrait');
  const portraits = expected({ q: 'pumpkin', style: 'outline', orientation: 'portrait' });
  await expect(cards()).toHaveCount(portraits.items.length);
  await expect(page.locator('#search-empty')).toBeVisible({ visible: portraits.total === 0 });
  report.checks.push('combined facets match actual catalog');
  await page.click('#clear-filters');
  await expect(cards()).toHaveCount(pumpkin.items.length);
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
  await expect(cards()).toHaveCount(
    expected({ q: 'black and white pumpkin', sort: 'title' }).items.length,
  );
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
  await page.goto(`${base}/search/?q=arctic+fox`);
  await expect(page.locator('#search-error')).toBeVisible();
  await expect(page.locator('#result-count')).toHaveText(
    'Search could not load. Your query and filters are kept.',
  );
  await page.unroute('**/search-data/**');
  await page.click('#search-retry');
  await expect(cards()).toHaveCount(expected({ q: 'arctic fox' }).items.length);
  await expect(
    cards().filter({ has: page.locator('[href="/art/winter-arctic-fox-resting/"]') }),
  ).toHaveCount(1);
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
  await page.fill('#search-query', 'cardinal');
  await page.locator('#catalog-search button').click();
  await expect(cards()).toHaveCount(cardinal.items.length);
  await expect(
    cards().filter({ has: page.locator('[href="/art/winter-red-cardinal-holly/"]') }),
  ).toHaveCount(1);
  release();
  await page.unroute(slow);
  await expect(page.locator('#result-count')).toContainText(`${cardinalCount} artworks`);
  await expect(page.locator('#result-count')).toContainText('for “cardinal”');
  report.checks.push('outdated request cannot overwrite newer results');
  // Favorites have no catalog cards in HTML. Small ID-location tables resolve
  // their bounded metadata chunks without loading the search/ranking index.
  await page.evaluate(() =>
    localStorage.setItem(
      'ultraclipart-favorites',
      JSON.stringify(['winter-arctic-fox-resting', 'winter-red-cardinal-holly']),
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
    (
      await page
        .locator('#favorites .art-card')
        .evaluateAll((nodes) => nodes.map((node) => node.dataset.id))
    ).sort(),
    ['winter-arctic-fox-resting', 'winter-red-cardinal-holly'],
  );
  const chunks = requested.filter((url) => url.includes('/items/'));
  assert.ok(chunks.length >= 1 && chunks.length <= 2);
  assert.ok(chunks.every((url) => /\/items\/\d+\.json$/.test(url)));
  assert.ok(requested.filter((url) => url.includes('/locations/')).length <= 2);
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
  await expect(cards()).toHaveCount(pumpkin.items.length);
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
