import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const base = process.env.BASE_URL || 'http://127.0.0.1:4334';
const engine = process.env.UC_BROWSER || 'chromium';
const out = resolve(process.env.EVIDENCE_DIR || 'reports/content', engine);
mkdirSync(out, { recursive: true });
const browser = await { chromium, firefox, webkit }[engine].launch({
  headless: true,
  ...(process.env.BROWSER_BIN ? { executablePath: process.env.BROWSER_BIN } : {}),
});
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const report = { base, engine, states: [], checks: [], errors: [], status: 'running' };
page.on('pageerror', (error) => report.errors.push(error.message));
const routes = [
  '/guides/',
  '/guides/make-a-classroom-label/',
  '/guides/turn-clipart-into-a-coloring-activity/',
  '/guides/webp-pdf-and-editable-projects/',
  '/print-size/',
  '/categories/',
  '/art/pumpkin-curly-vine/',
];
try {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      const response = await page.goto(base + route);
      assert.ok([200, 304].includes(response.status()), route);
      await page.evaluate(() => document.fonts.ready);
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const state = {
        route,
        width,
        overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        violations: result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      };
      report.states.push(state);
      assert.equal(state.overflow, false, JSON.stringify(state));
      assert.equal(state.violations.length, 0, JSON.stringify(state));
      await page.screenshot({
        path: resolve(out, `${route.replaceAll('/', '-')}-${width}.png`),
        fullPage: true,
      });
    }
  }
  await page.goto(base + '/print-size/');
  const form = page.locator('#print-calculator-form'),
    result = page.locator('#print-result');
  await expect(result).toContainText('512 pixels per inch');
  await form.locator('[name=pixelsHigh]').fill('4096');
  await form.locator('[name=printWidth]').fill('6');
  await form.getByRole('button').click();
  await expect(result).toContainText('6 × 12 inches');
  await expect(result).toContainText('Does not fit');
  await page.getByRole('button', { name: 'Use largest size that fits' }).click();
  await expect(result).toContainText('5 × 10 inches');
  await expect(result).toContainText('Fits inside');
  await form.locator('[name=units]').selectOption('mm');
  await expect(form.locator('[name=printWidth]')).toHaveValue('127');
  await expect(result).toContainText('127 × 254 millimeters');
  await form.locator('[name=units]').selectOption('in');
  await expect(form.locator('[name=printWidth]')).toHaveValue('5');
  await form.locator('[name=paper]').selectOption('a4');
  await form.locator('[name=landscape]').check();
  await page.getByRole('button', { name: 'Use largest size that fits' }).click();
  await expect(result).toContainText('Fits inside');
  await form.locator('[name=printWidth]').fill('501');
  await form.locator('[name=printWidth]').press('Tab');
  await expect(page.locator('#print-error')).toBeVisible();
  await expect(result).toBeHidden();
  await form.locator('[name=printWidth]').fill('4');
  await form.locator('[name=printWidth]').press('Enter');
  await expect(result).toBeVisible();
  report.checks.push(
    'calculator: exact density, ratio, two-axis fit, mm roundtrip, A4 landscape, invalid-state recovery, keyboard submit',
  );
  await page.goto(base + '/categories/');
  const catalog = JSON.parse(readFileSync(new URL('../../data/art.json', import.meta.url), 'utf8'));
  const topicCount = new Set(catalog.map((item) => item.topic)).size;
  await expect(page.locator('a[data-topic]')).toHaveCount(topicCount);
  await expect(page.locator('.topic-planned')).toHaveCount(110 - topicCount);
  await expect(page.locator('[data-topic]:not([hidden])')).toHaveCount(topicCount);
  await page.locator('#include-planned').check();
  await page.locator('#topic-filter').fill('heart');
  await expect(page.locator('[data-topic]:not([hidden])')).toHaveCount(1);
  await expect(page.locator('[data-topic]:not([hidden])')).toContainText('Planned');
  report.checks.push(
    'only populated topics link to public artwork; planned labels do not create empty destinations',
  );
  await page.goto(base + '/create/');
  await page.locator('[data-creator-template=school-label]').click();
  await page.locator('.uc-canvas [data-layer]').first().waitFor();
  await page.locator('[data-panel=text]').click();
  await page.locator('[data-text]').fill('Science');
  await page.locator('[data-action=text]').click();
  await expect(page.locator('.uc-canvas text').filter({ hasText: 'Science' })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.locator('[data-action=save]').click();
  const project = await pending;
  await project.saveAs(resolve(out, 'classroom-label.json'));
  report.checks.push(
    'guide workflow: actual Learning label starter, editable Science caption, downloaded project',
  );
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noScript.newPage();
  await staticPage.goto(base + '/print-size/');
  await expect(staticPage.locator('noscript p')).toBeVisible();
  await staticPage.goto(base + '/guides/make-a-classroom-label/');
  await expect(
    staticPage.getByRole('heading', { name: '1. Open the starter and find its pieces' }),
  ).toBeVisible();
  await noScript.close();
  report.checks.push('guides and honest calculator example remain readable without JavaScript');
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  process.exitCode = 1;
  await page.screenshot({ path: resolve(out, 'failure.png'), fullPage: true }).catch(() => {});
} finally {
  writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  await browser.close();
}
