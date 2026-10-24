import { chromium, firefox, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:4326';
const browserName = process.env.TEST_BROWSER ?? 'chromium';
const launcher = { chromium, firefox, webkit }[browserName];
assert.ok(launcher, 'TEST_BROWSER must be chromium, firefox or webkit');
const destination = resolve('reports/refinement', browserName);
mkdirSync(destination, { recursive: true });
const browser = await launcher.launch({
  headless: true,
  ...(process.env.BROWSER_BIN ? { executablePath: process.env.BROWSER_BIN } : {}),
});
const context = await browser.newContext();
const page = await context.newPage();
const report = {
  base,
  browser: browserName,
  date: new Date().toISOString(),
  status: 'running',
  states: [],
  checks: [],
  pageErrors: [],
};
page.on('pageerror', (error) =>
  report.pageErrors.push({ message: error.message, url: page.url(), stack: error.stack }),
);
const routes = [
  '/',
  '/categories/',
  '/new/',
  '/clipart/heart/',
  '/collection/christmas-winter/',
  '/black-and-white/',
  '/create/',
  '/art/winter-arctic-fox-resting/',
  '/edit/winter-arctic-fox-resting/',
];
try {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
    for (const route of routes) {
      const response = await page.goto(base + route);
      // Firefox may report a successful conditional navigation as HTTP 304.
      // Keep HTTP status strict otherwise; the DOM/asset checks below validate the cached page.
      assert.ok([200, 304].includes(response.status()), `${route}: HTTP ${response.status()}`);
      // The development-only toolbar is absent from production and is excluded from evidence.
      if (base.includes('127.0.0.1') || base.includes('localhost'))
        await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
      await page.evaluate(() => document.fonts.ready);
      if (route.startsWith('/edit/'))
        await page.locator('.uc-canvas [data-layer]').first().waitFor();
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].map(async (image) => {
            image.loading = 'eager';
            try {
              await image.decode();
            } catch {}
          }),
        );
      });
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        clippedCardTitles: [...document.querySelectorAll('.card-title')]
          .filter((title) => title.scrollWidth > title.clientWidth + 1)
          .map((title) => title.textContent),
        undersizedTargets: [
          ...document.querySelectorAll('.card-actions .button,.formats a,.az-nav button'),
        ]
          .filter((control) => {
            const r = control.getBoundingClientRect();
            return r.width < 43.5 || r.height < 43.5;
          })
          .map((control) => control.textContent),
        brokenImages: [...document.images]
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map((image) => image.src),
        headingCount: document.querySelectorAll('h1').length,
      }));
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const state = {
        route,
        width,
        ...layout,
        violations: axe.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      };
      report.states.push(state);
      await page.screenshot({
        path: resolve(
          destination,
          `${route.replaceAll('/', '-').replace(/^-|-$/g, '') || 'home'}-${width}.png`,
        ),
        fullPage: true,
      });
      console.log(
        `${width} ${route}: overflow=${state.overflow}; axe=${state.violations.length}; clipped=${state.clippedCardTitles.length}; targets=${state.undersizedTargets.length}; images=${state.brokenImages.length}`,
      );
    }
  }
  await page.goto(base + '/categories/');
  const publishedTopics = new Set(
    JSON.parse(readFileSync(new URL('../../data/art.json', import.meta.url), 'utf8')).map(
      (a) => a.topic,
    ),
  );
  const expected = [
    ...JSON.parse(readFileSync(new URL('../../data/topics.json', import.meta.url), 'utf8')).topics,
    ...JSON.parse(readFileSync(new URL('../../data/extra-topics.json', import.meta.url), 'utf8')),
  ]
    .filter((topic) => publishedTopics.has(topic.slug))
    .map((topic) => topic.keyword.toLowerCase())
    .sort();
  const actual = await page
    .locator('[data-topic]')
    .evaluateAll((links) => links.map((link) => link.dataset.topic).sort());
  assert.deepEqual(actual, expected);
  report.checks.push(
    'Every published subject has a preview and a link; planned subjects are excluded',
  );
  await page.locator('.discovery-alphabet summary').click();
  await page.locator('[data-letter=K]').click();
  assert.equal(await page.locator('[data-letter=K]').getAttribute('aria-pressed'), 'true');
  assert.ok(
    (
      await page
        .locator('[data-topic]:not([hidden])')
        .evaluateAll((cards) => cards.map((card) => card.dataset.name))
    ).every((text) => text.toLowerCase().startsWith('k')),
  );
  await page.locator('[data-letter=""]').click();
  await page.locator('#topic-filter').fill('  ＰＵＭＰＫＩＮ  ');
  assert.equal(await page.locator('[data-topic]:not([hidden])').count(), 1);
  await page.locator('#topic-filter').fill('no-such-subject');
  assert.equal(await page.locator('#no-topics').isVisible(), true);
  await page.locator('#clear-topic-filter').click();
  assert.equal(
    await page.locator('[data-topic]:not([hidden])').count(),
    Math.min(16, expected.length),
  );
  assert.equal(
    await page.locator('#topic-filter').evaluate((input) => input === document.activeElement),
    true,
  );
  report.checks.push(
    'A–Z pressed states, normalized search, progressive disclosure, live counts and empty-state reset',
  );
  const art = JSON.parse(readFileSync(new URL('../../data/art.json', import.meta.url), 'utf8'));
  for (const [route, cap] of [
    ['/', 12],
    ['/new/', 32],
    ['/black-and-white/', 32],
  ]) {
    await page.goto(base + route);
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map(async (image) => {
          image.loading = 'eager';
          try {
            await image.decode();
          } catch {}
        }),
      );
    });
    assert.equal(await page.locator('.gallery > .art-card').count(), Math.min(art.length, cap));
  }
  report.checks.push('Home and browse galleries enforce their 12/32 card bounds');
  report.status =
    report.states.some(
      (state) =>
        state.overflow ||
        state.violations.length ||
        state.clippedCardTitles.length ||
        state.undersizedTargets.length ||
        state.brokenImages.length ||
        state.headingCount !== 1,
    ) || report.pageErrors.length
      ? 'failed'
      : 'passed';
  assert.equal(report.status, 'passed');
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  throw error;
} finally {
  writeFileSync(resolve(destination, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      status: report.status,
      states: report.states.length,
      checks: report.checks,
      pageErrors: report.pageErrors,
    }),
  );
  await context.close();
  await browser.close();
}
