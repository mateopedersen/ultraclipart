import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4323',
  engine = process.env.UC_BROWSER || 'chromium';
const out = process.env.EVIDENCE_DIR || `reports/categories-refresh/${engine}`;
const browser = await { chromium, webkit }[engine].launch(),
  page = await browser.newPage();
const report = { engine, base, states: [], errors: [], status: 'running' };
mkdirSync(out, { recursive: true });
page.on('pageerror', (e) => report.errors.push(e.message));
try {
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base + '/categories/');
    await expect(page.locator('#discovery-controls')).toHaveAttribute('data-ready', 'true');
    if (await page.locator('#cookie-notice [data-cookie-choice=necessary]').isVisible())
      await page.locator('#cookie-notice [data-cookie-choice=necessary]').click();
    if (width < 980) await page.locator('#discovery-controls > summary').click();
    const options = await page
      .locator('[name=collection-filter]')
      .evaluateAll((es) => es.map((e) => e.value));
    for (const group of options) {
      await page
        .locator('label')
        .filter({ has: page.locator(`[name=collection-filter][value="${group}"]`) })
        .click();
      const metrics = await page.locator('#subject-grid').evaluate((grid) => {
        const bounds = grid.getBoundingClientRect();
        const boxes = [...grid.querySelectorAll('[data-topic]:not([hidden])')].map((el) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom,
          };
        });
        const rows = [];
        for (const box of boxes) {
          let row = rows.find((r) => Math.abs(r.y - box.y) < 1);
          if (!row) {
            row = { y: box.y, boxes: [] };
            rows.push(row);
          }
          row.boxes.push(box);
        }
        const first = rows[0]?.boxes || [];
        return {
          columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
          count: boxes.length,
          escaped: boxes.some((r) => r.x < bounds.x - 1 || r.right > bounds.right + 1),
          widthSpread:
            Math.max(...boxes.map((r) => r.width)) - Math.min(...boxes.map((r) => r.width)),
          heightSpread:
            Math.max(...boxes.map((r) => r.height)) - Math.min(...boxes.map((r) => r.height)),
          unaligned: rows.some((row) => row.boxes.some((r, i) => Math.abs(r.x - first[i].x) > 1)),
          rowCounts: rows.map((r) => r.boxes.length),
        };
      });
      assert.equal(metrics.escaped, false, `${width}/${group} escape`);
      assert.equal(metrics.unaligned, false, `${width}/${group} unaligned columns`);
      assert.ok(
        metrics.widthSpread < 2 && metrics.heightSpread < 2,
        JSON.stringify({ width, group, ...metrics }),
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      report.states.push({ width, group, ...metrics });
      if (group === 'halloween' && [390, 1440].includes(width)) {
        await page
          .locator('#topic-directory')
          .screenshot({ path: `${out}/halloween-${width}.png` });
      }
    }
    for (const [query, first] of [
      ['bunnies', 'Rabbit'],
      ['sunflwer', 'Sunflower'],
      ['birthday card', 'Happy birthday'],
    ]) {
      await page
        .locator('label')
        .filter({ has: page.locator('[name=collection-filter][value=""]') })
        .click();
      await page.locator('#topic-filter').fill(query);
      await expect(page.locator('[data-topic]:not([hidden]) h3').first()).toHaveText(first);
    }
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} finally {
  writeFileSync(`${out}/collections.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(
  JSON.stringify({
    engine,
    states: report.states.length,
    status: report.status,
    errors: report.errors,
  }),
);
