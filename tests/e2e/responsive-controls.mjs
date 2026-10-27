import { chromium, webkit, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { inspectLayout } from '../helpers/layout-audit.mjs';
const engine = process.env.UC_BROWSER || 'chromium',
  base = process.env.BASE_URL || 'http://127.0.0.1:4326';
const out = process.env.EVIDENCE_DIR || `reports/responsive-controls/${engine}`;
mkdirSync(out, { recursive: true });
const browser = await { chromium, webkit }[engine].launch(),
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
const page = await context.newPage();
const report = {
  engine,
  base,
  started: new Date().toISOString(),
  states: [],
  errors: [],
  smallFields: [],
  smallTargets: [],
  generationRequests: 0,
  status: 'running',
};
page.on('pageerror', (e) => report.errors.push({ url: page.url(), message: e.message }));
await page.route('**/api/ai/clipart/generate*', (route) => {
  report.generationRequests++;
  return route.abort();
});
try {
  for (const route of [
    '/',
    '/categories/',
    '/collections/',
    '/search/?q=sunflower',
    '/black-and-white/',
    '/favorites/',
    '/create/',
    '/ai-clipart-generator/',
    '/contact/',
    '/print-size/',
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + (route === '/create/' ? '/create/?view=page' : route));
    await page.evaluate(() => document.fonts.ready);
    const consent = page.locator('#cookie-notice [data-cookie-choice=necessary]');
    if (await consent.isVisible()) await consent.tap();
    if (route === '/categories/') await page.locator('#discovery-controls > summary').tap();
    if (route === '/create/') {
      await page.locator('.uc-editor').scrollIntoViewIfNeeded();
      await expect(page.locator('.uc-workspace')).not.toHaveAttribute('inert', '', {
        timeout: 30000,
      });
    }
    const measure = await page.evaluate(() => {
      const visible = (e) => {
        const r = e.getBoundingClientRect();
        return (
          r.width &&
          r.height &&
          !e.closest('[hidden],dialog:not([open])') &&
          getComputedStyle(e).visibility !== 'hidden'
        );
      };
      const identify = (e) =>
        e.id || e.name || e.getAttribute('aria-label') || e.textContent.trim().slice(0, 45);
      const fields = [
        ...document.querySelectorAll(
          'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]),textarea,select',
        ),
      ]
        .filter(visible)
        .map((e) => ({ id: identify(e), px: parseFloat(getComputedStyle(e).fontSize) }));
      const targets = [...document.querySelectorAll('main button,main summary,main .button')]
        .filter((e) => visible(e) && !e.disabled)
        .map((e) => ({
          id: identify(e),
          w: e.getBoundingClientRect().width,
          h: e.getBoundingClientRect().height,
        }));
      return {
        fields: fields.filter((e) => e.px < 16),
        targets: targets.filter((e) => e.w < 24 || e.h < 24),
      };
    });
    report.smallFields.push(...measure.fields.map((f) => ({ route, ...f })));
    report.smallTargets.push(...measure.targets.map((t) => ({ route, ...t })));
    const field = page
      .locator(
        'main input[type=search]:visible, main input[type=text]:visible, main textarea:visible',
      )
      .first();
    if (await field.count()) {
      await field.scrollIntoViewIfNeeded();
      await field.tap();
      await expect(field).toBeFocused();
      await page.setViewportSize({ width: 390, height: 430 });
      await field.scrollIntoViewIfNeeded();
      const layout = await page.evaluate(inspectLayout);
      report.states.push({ route, mode: 'reduced-height', width: 390, height: 430, layout });
      assert.equal(layout.horizontalOverflow, false, route + ' reduced-height overflow');
      assert.deepEqual(layout.clipped, [], route + ' reduced-height clipped');
    }
    await page.setViewportSize({ width: 844, height: 390 });
    const layout = await page.evaluate(inspectLayout);
    report.states.push({ route, mode: 'landscape', width: 844, height: 390, layout });
    assert.equal(layout.horizontalOverflow, false, route + ' landscape overflow');
    assert.deepEqual(layout.clipped, [], route + ' landscape clipped');
    await page.screenshot({
      path: `${out}/${route.replace(/[^a-z0-9]/gi, '-') || 'home'}-landscape.png`,
    });
  }
  assert.deepEqual(report.smallFields, [], 'Mobile text entry controls must be at least 16px');
  assert.deepEqual(
    report.smallTargets,
    [],
    'Interactive controls must retain usable touch targets',
  );
  assert.equal(report.generationRequests, 0);
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  report.finished = new Date().toISOString();
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(
  JSON.stringify({
    engine,
    states: report.states.length,
    smallFields: report.smallFields,
    smallTargets: report.smallTargets,
    errors: report.errors,
    status: report.status,
  }),
);
