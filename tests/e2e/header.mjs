import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:4353';
const name = process.env.UC_BROWSER || 'chromium';
const launcher = { chromium, firefox, webkit }[name];
assert.ok(launcher, 'UC_BROWSER must be chromium, firefox or webkit');
const output = resolve(process.env.EVIDENCE_DIR || 'reports/header', name);
await mkdir(output, { recursive: true });
const browser = await launcher.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
const errorDetails = [];
const requestFailures = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('pageerror', (error) =>
  errorDetails.push({ url: page.url(), message: error.message, stack: error.stack }),
);
page.on('requestfailed', (request) =>
  requestFailures.push({ url: request.url(), page: page.url(), reason: request.failure() }),
);
let generationRequests = 0;
await page.route('**/api/ai/clipart/quota', (route) =>
  route.fulfill({
    json: {
      enabled: false,
      remaining: 0,
      globalRemaining: 0,
      resetAt: '2026-10-25T00:00:00Z',
    },
  }),
);
await page.route('**/api/ai/clipart/generate', (route) => {
  generationRequests++;
  return route.fulfill({ status: 503, json: { error: 'No inference in header tests' } });
});
const report = {
  status: 'running',
  base,
  browser: name,
  browserVersion: browser.version(),
  date: new Date().toISOString(),
  scope: 'Global header behavior and accessibility, four routes and five widths; no AI calls',
  checks: [],
  layouts: [],
  accessibility: [],
  destinations: [],
  errors,
  errorDetails,
  requestFailures,
};
const header = page.locator('.site-header');
const navigation = header.locator('#navigation');
const menu = header.locator('.menu-button');
const browse = header.locator('#site-browse-toggle');
const resources = header.locator('#site-resources-toggle');

async function scan(label) {
  const surprise = header.locator('.site-surprise-link');
  if (await surprise.isVisible())
    await expect(surprise).toHaveAccessibleName(/Surprise me.*A little reason to smile/);
  const result = await new AxeBuilder({ page })
    .include('.site-header')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const violations = result.violations.map((item) => ({
    id: item.id,
    impact: item.impact,
    nodes: item.nodes.map((node) => ({ target: node.target, reason: node.failureSummary })),
  }));
  report.accessibility.push({ label, violations });
  assert.deepEqual(violations, [], `${label}: header accessibility`);
}

async function checkBounds(selector, label) {
  const bounds = await page.locator(selector).boundingBox();
  assert.ok(bounds && bounds.width > 0 && bounds.height > 0, `${label}: visible bounds`);
  const width = page.viewportSize().width;
  assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1, `${label}: fits viewport`);
}

async function expectClosed() {
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(browse).toHaveAttribute('aria-expanded', 'false');
  await expect(resources).toHaveAttribute('aria-expanded', 'false');
  await expect(header.locator('#site-browse-panel')).toBeHidden();
  await expect(header.locator('#site-resources-panel')).toBeHidden();
}

try {
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/', '/categories/', '/create/', '/ai-clipart-generator/']) {
      const response = await page.goto(base + route);
      assert.equal(response.status(), 200, `${route} returns 200`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');
      await expect(header).toBeVisible();
      await expect(navigation).toHaveAttribute('aria-label', 'Main navigation');
      await expectClosed();
      const dimensions = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: innerWidth,
      }));
      const mobile = await menu.isVisible();
      const layout = { route, width, mobile, ...dimensions };
      report.layouts.push(layout);
      assert.ok(dimensions.document <= width + 1, `${route} at ${width}px: page overflow`);
      await checkBounds('.site-header', `${route} header ${width}`);
      if (mobile) await expect(navigation).toBeHidden();
      else await expect(navigation).toBeVisible();
      await expect(header.locator('.site-surprise-link')).toBeVisible();
      await checkBounds('.site-surprise-link', `Surprise me ${route} ${width}`);
      const current = await navigation
        .locator('a[aria-current="page"]')
        .evaluateAll((links) => links.map((link) => new URL(link.href).pathname));
      assert.deepEqual(current, [route], `${route}: exactly one correct current navigation link`);
      if (route === '/categories/') {
        await expect(page.locator('.discovery-breadcrumb')).toBeVisible();
        await checkBounds('.discovery-breadcrumb', `category breadcrumb ${width}`);
      }
      if (route === '/create/') {
        await expect(page.locator('.uc-tools')).toBeVisible();
        await expect(page.locator('.uc-tools button:visible').first()).toBeVisible();
        await checkBounds('.uc-tools', `Studio toolbar ${width}`);
      }
      await scan(`${route} ${width} closed`);
      if (route !== '/') continue;
      await page.screenshot({ path: resolve(output, `header-${width}.png`), fullPage: false });

      if (!mobile) {
        const fonts = await header
          .locator('.site-nav-trigger, .site-studio-link, .site-ai-link, .site-favorites-link')
          .evaluateAll((items) =>
            items.map((item) => ({
              label: item.textContent.trim(),
              px: parseFloat(getComputedStyle(item).fontSize),
            })),
          );
        assert.ok(
          fonts.every((item) => item.px >= 14),
          `Desktop primary labels >=14px: ${JSON.stringify(fonts)}`,
        );
        await browse.click();
        await expect(browse).toHaveAttribute('aria-expanded', 'true');
        await expect(header.locator('#site-browse-panel')).toBeVisible();
        await checkBounds('#site-browse-panel', `Browse ${width}`);
        await scan(`Browse ${width} open`);
        await page.screenshot({ path: resolve(output, `browse-${width}.png`), fullPage: false });
        await resources.click();
        await expect(browse).toHaveAttribute('aria-expanded', 'false');
        await expect(resources).toHaveAttribute('aria-expanded', 'true');
        await checkBounds('#site-resources-panel', `Resources ${width}`);
        await scan(`Resources ${width} open`);
        await page.keyboard.press('Escape');
        await expectClosed();
        await expect(resources).toBeFocused();
        await browse.focus();
        await page.keyboard.press('ArrowDown');
        await expect(header.locator('#site-browse-panel a').first()).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(browse).toBeFocused();
        await browse.click();
        await page.mouse.click(1, 999);
        await expectClosed();
        report.checks.push(
          `Desktop ${width}: disclosures, exclusive open state, Escape, ArrowDown focus and outside close`,
        );
      } else {
        await menu.click();
        await expect(menu).toHaveAttribute('aria-expanded', 'true');
        await expect(navigation).toBeVisible();
        await expect(browse).toHaveAttribute('aria-expanded', 'true');
        await expect(resources).toHaveAttribute('aria-expanded', 'true');
        await expect(
          navigation.getByRole('link', { name: 'Categories', exact: true }),
        ).toBeVisible();
        await checkBounds('#navigation', `Mobile navigation ${width}`);
        await scan(`Mobile ${width} open`);
        await page.screenshot({ path: resolve(output, `menu-${width}.png`), fullPage: false });
        await browse.click();
        await expect(browse).toHaveAttribute('aria-expanded', 'false');
        await expect(resources).toHaveAttribute('aria-expanded', 'true');
        await browse.click();
        await page.keyboard.press('Escape');
        await expectClosed();
        await expect(menu).toBeFocused();
        await expect(navigation).toBeHidden();
        await menu.click();
        await page.mouse.click(1, 999);
        await expectClosed();
        await expect(navigation).toBeHidden();
        report.checks.push(
          `Mobile ${width}: menu and both groups open, independent collapse, Escape focus return and outside close`,
        );
      }
      console.log(`Header ${width}px interactions and accessibility passed`);
    }
  }

  const hrefs = await header
    .locator('a[href]')
    .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')))]);
  for (const path of hrefs) {
    assert.ok(path.startsWith('/') && !path.startsWith('//'), `Local header destination: ${path}`);
    const response = await context.request.get(base + path);
    report.destinations.push({ path, status: response.status() });
    assert.equal(response.status(), 200, `Header link ${path}`);
  }
  for (const expected of ['/', '/categories/', '/create/', '/ai-clipart-generator/', '/favorites/'])
    assert.ok(hrefs.includes(expected), `Required destination ${expected}`);
  report.checks.push(
    'Every unique header destination returns 200; expected Studio, AI Builder and Favorites links present',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/');
  await menu.click();
  await navigation.getByRole('link', { name: 'Categories', exact: true }).click();
  await page.waitForURL('**/categories/');
  await page.waitForLoadState('networkidle');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await navigation.getByRole('link', { name: /AI Clipart Builder/ }).click();
  await page.waitForURL('**/ai-clipart-generator/');
  await page.waitForLoadState('networkidle');
  await expect(header.locator('.site-ai-link')).toHaveAttribute('aria-current', 'page');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  report.checks.push(
    'Mobile Categories and AI Builder links navigate; menu closes and current route updates',
  );

  await page.setViewportSize({ width: 1440, height: 1000 });
  await browse.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectClosed();
  await expect(navigation).toBeHidden();
  await menu.click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expectClosed();
  await expect(navigation).toBeVisible();
  report.checks.push('Breakpoint changes clear stale open states and retain desktop navigation');
  assert.equal(generationRequests, 0, 'Header navigation must not generate AI images');
  assert.deepEqual(errors, [], 'No JavaScript page errors');
  report.generationRequests = generationRequests;
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.stack || error.message;
  await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: false }).catch(() => {});
  throw error;
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(
  `${name}: header checks passed; ${report.layouts.length} layouts, ${report.accessibility.length} accessibility states, no AI calls`,
);
