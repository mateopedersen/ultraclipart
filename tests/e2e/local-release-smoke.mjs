import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4326',
  report = { base, states: [], errors: [], status: 'running' };
for (const [name, engine] of Object.entries({ chromium, webkit })) {
  const browser = await engine.launch();
  const context = await browser.newContext({
      viewport: { width: name === 'chromium' ? 1440 : 390, height: 1000 },
    }),
    page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  try {
    let res = await page.goto(base + '/categories/?collection=halloween');
    assert.equal(res.status(), 200);
    await expect(page.locator('#discovery-controls')).toHaveAttribute('data-ready', 'true');
    const names = await page.locator('[data-topic]:not([hidden]) h3').allTextContents();
    assert.deepEqual(names, ['Ghost', 'Halloween', 'Skeleton', 'Vampire', 'Witch']);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    const cookie = page.locator('#cookie-notice [data-cookie-choice=necessary]');
    if (await cookie.isVisible()) await cookie.click();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `reports/categories-refresh/verified-categories-${name}.png` });
    report.states.push({ name, route: '/categories/', halloweenSubjects: names });
    res = await page.goto(base + '/collections/');
    assert.equal(res.status(), 200);
    await expect(page.locator('#latest-collections>a')).toHaveCount(8);
    const feed = await page.request.get(base + '/collection-feed.json');
    assert.equal(feed.status(), 200);
    assert.match(feed.headers()['cache-control'], /no-store/);
    const color = await page
      .locator('.collection-section .collection-eyebrow')
      .first()
      .evaluate((e) => getComputedStyle(e).color);
    assert.equal(color, 'rgb(20, 100, 212)');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('#latest-collections img').evaluateAll((imgs) =>
      Promise.all(
        imgs.map(async (img) => {
          img.loading = 'eager';
          await img.decode();
        }),
      ),
    );
    await page.screenshot({ path: `reports/categories-refresh/verified-collections-${name}.png` });
    report.states.push({ name, route: '/collections/', feedCache: 'no-store', accent: color });
    res = await page.goto(base + '/black-and-white/?q=sunflwer');
    assert.equal(res.status(), 200);
    await expect(page.locator('#bw-results')).toHaveAttribute('aria-busy', 'false', {
      timeout: 30000,
    });
    await expect(page.locator('#bw-sort')).toHaveValue('relevance');
    assert.ok((await page.locator('#bw-results .art-card').count()) > 0);
    // Stable IDs are not visual descriptions: an eligible bat-and-sunflower
    // drawing is a valid sunflower result even when its ID starts with bat.
    assert.match(
      await page.locator('#bw-results .art-card').first().locator('.card-title').innerText(),
      /sunflower/i,
    );
    report.states.push({ name, route: '/black-and-white/', sort: 'relevance', typoFound: true });
  } finally {
    await browser.close();
  }
}
assert.deepEqual(report.errors, []);
report.status = 'passed';
writeFileSync(
  'reports/categories-refresh/verified-release-smoke.json',
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
