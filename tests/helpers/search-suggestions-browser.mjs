import { expect } from '@playwright/test';
import assert from 'node:assert/strict';

export async function checkSearchSuggestions(browser, base, engine) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    ...(engine === 'firefox' ? {} : { isMobile: true }),
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const checks = [];
  const input = page.locator('#search-q');
  async function query(text) {
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await expect(page.locator('form:has(#search-q)')).toHaveAttribute(
      'data-suggestions-ready',
      'true',
    );
    await input.tap();
    await input.fill(text);
    await expect(page.locator('.search-suggestions:not([hidden])')).toHaveAttribute(
      'aria-busy',
      'false',
    );
  }
  const options = () => page.locator('.search-suggestions:not([hidden]) a');
  try {
    await query('baby pumpkin costume');
    const artwork = page.locator(
      '.search-suggestions a[href="/art/baby-pumpkin-costume-clipart/"]',
    );
    await expect(artwork).toHaveAttribute('href', '/art/baby-pumpkin-costume-clipart/');
    await artwork.locator('span').first().tap();
    await page.waitForURL('**/art/baby-pumpkin-costume-clipart/');
    checks.push('mobile native tap on suggestion text navigates');
    await query('arctic fox resting');
    const fox = page.locator('.search-suggestions a[href="/art/winter-arctic-fox-resting/"]');
    const foxHref = await fox.getAttribute('href');
    await fox.locator('img').tap();
    await page.waitForURL((url) => url.pathname === foxHref);
    checks.push('mobile native tap on thumbnail navigates');
    await query('pumpkin');
    await expect(options().first().locator('small')).toHaveText('Subjects');
    const topicHref = await options().first().getAttribute('href');
    await options().first().tap();
    await page.waitForURL((url) => url.pathname === topicHref);
    checks.push('exact subject appears first and opens its collection');
    await query('I am searching for a red cardinal with holly');
    await expect(options().first()).toHaveAttribute('href', '/art/winter-red-cardinal-holly/');
    await options().last().tap();
    await page.waitForURL((url) => url.pathname === '/search/');
    assert.equal(
      new URL(page.url()).searchParams.get('q'),
      'I am searching for a red cardinal with holly',
    );
    await expect(page.locator('#search-results .art-card').first()).toHaveAttribute(
      'data-id',
      'winter-red-cardinal-holly',
    );
    checks.push('natural long-tail request finds exact artwork and all-results link keeps query');
    await query('baby pumpkin costume');
    await input.press('ArrowDown');
    await input.press('Enter');
    await page.waitForURL('**/art/baby-pumpkin-costume-clipart/');
    checks.push('keyboard selection navigates');
    await query('pumpkin');
    await input.press('Escape');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await input.fill('arctic fox');
    await expect(options().first()).toBeVisible();
    await page.locator('h1').tap();
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    checks.push('Escape and outside tap close suggestions');
    await page.route('**/search-data/**', (route) => route.abort());
    await query('red fox');
    await expect(options()).toHaveCount(1);
    await expect(options().first()).toHaveAttribute('href', '/search/?q=red%20fox');
    checks.push('failed suggestions retain a usable native search link');
    assert.deepEqual(errors, []);
    return checks;
  } finally {
    await context.close();
  }
}
