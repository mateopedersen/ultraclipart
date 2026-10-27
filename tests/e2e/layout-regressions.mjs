import { chromium, webkit, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { inspectLayout } from '../helpers/layout-audit.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4323';
const out = process.env.EVIDENCE_DIR || 'reports/layout-regressions';
mkdirSync(out, { recursive: true });
const report = { date: new Date().toISOString(), states: [], errors: [] };
for (const [engine, implementation] of Object.entries({ chromium, webkit })) {
  const browser = await implementation.launch();
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  async function go(route) {
    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    const choice = page.locator('[data-cookie-choice="necessary"]:visible').first();
    if (await choice.count()) await choice.click();
  }
  try {
    for (const viewport of [
      { width: 1280, height: 600 },
      { width: 1440, height: 500 },
    ]) {
      await page.setViewportSize(viewport);
      await go('/');
      await page.locator('#site-browse-toggle').click();
      const panel = page.locator('#site-browse-panel');
      const bounds = await panel.boundingBox();
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
      const action = panel.getByText('Browse All Subjects', { exact: true });
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeInViewport();
      await page.screenshot({
        path: `${out}/${engine}-browse-${viewport.width}x${viewport.height}.png`,
      });
      report.states.push({
        engine,
        name: 'short-menu',
        ...viewport,
        bounds,
        ...(await page.evaluate(inspectLayout)),
      });
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
    }
    for (const width of [320, 390, 414, 768]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/search/?q=flower', '/black-and-white/']) {
        await go(route);
        const values = await page
          .locator('.filters select, .bw-filter-row select')
          .evaluateAll((selects) =>
            selects.map((select) => {
              const s = getComputedStyle(select),
                canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              ctx.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
              const label = select.selectedOptions[0].textContent.trim();
              return {
                label,
                available:
                  select.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight),
                textWidth: ctx.measureText(label).width,
              };
            }),
          );
        const layout = await page.evaluate(inspectLayout);
        report.states.push({ engine, name: 'filter-labels', route, values, ...layout });
        for (const value of values)
          expect(value.available, `${route} ${width}: ${value.label}`).toBeGreaterThanOrEqual(
            value.textWidth - 1,
          );
        expect(layout.horizontalOverflow).toBe(false);
        expect(layout.clipped).toEqual([]);
        await page.locator('.filters, .bw-filter-row').scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `${out}/${engine}-${route.startsWith('/search') ? 'search' : 'bw'}-${width}.png`,
        });
      }
    }
  } catch (e) {
    report.errors.push({ engine, message: e.message });
  } finally {
    await browser.close();
  }
}
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.errors.length) process.exitCode = 1;
