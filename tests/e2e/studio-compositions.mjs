import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const engine = process.env.UC_BROWSER || 'chromium',
  base = process.env.BASE_URL || 'http://127.0.0.1:4323',
  out = `reports/studio-compositions/${engine}`;
mkdirSync(out, { recursive: true });
const browser = await { chromium, webkit }[engine].launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1050 },
  acceptDownloads: true,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const report = { engine, projects: [], errors, status: 'running' };
try {
  await page.goto(base + '/create/?view=page');
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true', {
    timeout: 60000,
  });
  const cookie = page.locator('[data-cookie-choice=necessary]:visible');
  if (await cookie.count()) await cookie.first().click();
  const cards = await page
    .locator('[data-studio-scene]')
    .evaluateAll((nodes) =>
      nodes.map((n) => ({
        id: n.dataset.studioScene,
        title: n.querySelector('.studio-scene-label strong').textContent,
      })),
    );
  assert.equal(cards.length, 18);
  while (await page.locator('[data-scene-more]').isVisible())
    await page.locator('[data-scene-more]').click();
  await page.locator('#studio-scene-grid').screenshot({ path: `${out}/gallery.png` });
  for (const { id, title } of cards) {
    if ((await page.locator('.uc-editor').getAttribute('data-wb-focus')) === 'true')
      await page.locator('[data-wb-back-page]').click();
    while (await page.locator('[data-scene-more]').isVisible())
      await page.locator('[data-scene-more]').click();
    await page.locator(`[data-studio-scene="${id}"]`).click();
    await expect(page.locator('[data-status]')).toContainText(`${title} opened.`, {
      timeout: 60000,
    });
    await expect(page.locator('.uc-command h2')).toHaveText(title);
    const doc = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('ultraclipart:editor:v1:my-clipart')),
    );
    assert.ok(doc.layers.length >= 10);
    assert.ok(doc.layers.filter((l) => l.kind === 'text').length >= 3);
    assert.ok(doc.layers.filter((l) => l.kind === 'vector').length >= 3);
    assert.ok(doc.layers.some((l) => l.kind === 'raster'));
    await page.evaluate(() => document.fonts.ready);
    const escaped = await page
      .locator('[data-artwork-canvas]')
      .first()
      .evaluate((svg) => {
        const inverse = svg.getCTM().inverse();
        return [...svg.querySelectorAll('g[data-layer]')].flatMap((g) => {
          const b = g.getBBox(),
            m = inverse.multiply(g.getCTM());
          const points = [
            [b.x, b.y],
            [b.x + b.width, b.y],
            [b.x, b.y + b.height],
            [b.x + b.width, b.y + b.height],
          ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
          const bad = points.some((p) => p.x < -2 || p.y < -2 || p.x > 1402 || p.y > 1002);
          return bad
            ? [{ id: g.dataset.layer, box: { x: b.x, y: b.y, width: b.width, height: b.height } }]
            : [];
        });
      });
    assert.deepEqual(escaped, [], id + ' has clipped layers');
    await page.locator('[data-action=export]').click();
    const dialog = page.locator('[data-export-dialog]');
    await dialog.locator('[data-format][value=png]').check({ force: true });
    await dialog.locator('[data-size]').selectOption('1024');
    const wait = page.waitForEvent('download', { timeout: 60000 });
    await dialog.locator('[data-action=download]').click();
    const file = await wait;
    await file.saveAs(`${out}/${id}.png`);
    await dialog.locator('[data-action=close-export]').click();
    report.projects.push({
      id,
      title,
      layers: doc.layers.length,
      text: doc.layers.filter((l) => l.kind === 'text').length,
      raster: doc.layers.filter((l) => l.kind === 'raster').length,
      exported: true,
    });
    console.log(`${report.projects.length}/18 ${id} (${doc.layers.length} layers)`);
  }
  assert.deepEqual(errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = String(error);
  await page.screenshot({ path: `${out}/failure.png` });
  throw error;
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
