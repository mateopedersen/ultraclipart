import { chromium, webkit, firefox, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { installProductionCsp } from '../helpers/production-csp.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw Error('Local only');
const out = process.env.COOKIE_STARTUP_OUT || 'reports/performance/cookie-startup';
const enforceCsp = process.env.COOKIE_CSP === '1';
mkdirSync(out, { recursive: true });
const report = {
  started: new Date().toISOString(),
  fixtureNote: 'Regional responses are controlled UI fixtures, not a real IP geolocation test.',
  cspFixture: enforceCsp
    ? 'Production policy and generated inline hashes enforced by the browser on local documents'
    : false,
  checks: [],
  failures: [],
};
const engines = process.env.UC_BROWSER
  ? { [process.env.UC_BROWSER]: { chromium, webkit, firefox }[process.env.UC_BROWSER] }
  : { chromium, webkit };
for (const [engine, implementation] of Object.entries(engines)) {
  const browser = await implementation.launch();
  for (const [path, region] of [
    '/search/?q=baby',
    '/edit/classic-white-volleyball-realistic-clipart/',
  ].flatMap((path) => ['notice', 'no-notice', 'failure'].map((region) => [path, region]))) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: engine !== 'firefox',
    });
    const page = await context.newPage();
    let regionRequests = 0,
      release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    try {
      if (enforceCsp) await installProductionCsp(page);
      await context.addInitScript(() =>
        localStorage.setItem(
          'performance-preserved-work',
          JSON.stringify({ favorites: ['test'], project: 'keep' }),
        ),
      );
      await page.route('**/api/cookie-region.json', async (route) => {
        regionRequests++;
        if (region === 'failure') return route.abort();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ showNotice: region === 'notice' }),
        });
      });
      // Prove that an unrelated slow footer module cannot delay the notice.
      if (region === 'notice')
        await page.route('**/DownloadPanel*.js', async (route) => {
          await gate;
          await route.continue();
        });
      if (region === 'notice' && path.startsWith('/edit/'))
        await page.route(
          '**/catalog/volleyball/classic-white-volleyball-realistic-clipart.webp',
          async (route) => {
            await gate;
            await route.continue();
          },
        );
      await page.goto(base + path, { waitUntil: 'commit' });
      if (region === 'no-notice') {
        await expect.poll(() => regionRequests).toBe(1);
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('#cookie-notice')).toBeHidden();
        await expect(page.locator('footer.site-footer')).toHaveAttribute('data-ready', 'true');
        const help = page.locator('footer.site-footer .footer-nav-help');
        if ((await help.getAttribute('open')) === null) await help.locator('summary').click();
        await page.locator('footer.site-footer a[href="/cookies/"]').click();
        await page.waitForURL('**/cookies/');
        await page.locator('#cookie-preferences [data-cookie-settings]').click();
        await expect(page.locator('#cookie-settings-dialog')).toBeVisible();
        await page.locator('#cookie-settings-dialog [data-cookie-choice="accepted"]').click();
      } else {
        await expect(page.locator('#cookie-notice')).toBeVisible({ timeout: 10000 });
        release();
        await page.locator('#cookie-notice [data-cookie-choice="necessary"]').click();
      }
      release();
      await expect(page.locator('#cookie-notice')).toBeHidden();
      const saved = (await context.cookies()).find((c) => c.name === 'uc_cookie_choice');
      assert.ok(saved);
      assert.equal(
        JSON.parse(decodeURIComponent(saved.value)).choice,
        region === 'no-notice' ? 'accepted' : 'necessary',
      );
      assert.deepEqual(
        await page.evaluate(() => JSON.parse(localStorage.getItem('performance-preserved-work'))),
        { favorites: ['test'], project: 'keep' },
      );
      const previousRequests = regionRequests;
      await page.goto(base + '/privacy/');
      await expect(page.locator('#cookie-notice')).toBeHidden();
      assert.equal(
        regionRequests,
        previousRequests,
        'remembered valid choice must avoid another regional request',
      );
      report.checks.push({
        engine,
        path,
        region,
        passed: true,
        check:
          'Early independent startup, regional choice, saved preference and preserved browser work',
      });
    } catch (error) {
      release();
      report.failures.push({ engine, path, region, error: error.stack });
    } finally {
      await context.close();
      writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
    }
  }
  await browser.close();
}
report.finished = new Date().toISOString();
writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
assert.deepEqual(report.failures, []);
