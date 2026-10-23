import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
const base = process.env.BASE_URL || 'http://127.0.0.1:4335',
  engine = process.env.UC_BROWSER || 'chromium';
const out = resolve(process.env.EVIDENCE_DIR || 'reports/raster-editor', engine);
mkdirSync(out, { recursive: true });
const requestedIds = new Set((process.env.RASTER_IDS || '').split(',').filter(Boolean));
const art = JSON.parse(readFileSync(new URL('../../data/art.json', import.meta.url))).filter(
  (a) =>
    a.sourceType === 'raster' &&
    (!requestedIds.size || requestedIds.has(a.id)) &&
    (process.env.RASTER_REPLACEMENTS !== '1' || Boolean(a.replacesArtwork)) &&
    (!process.env.RASTER_TOPICS || process.env.RASTER_TOPICS.split(',').includes(a.topic)),
);
if (requestedIds.size)
  assert.deepEqual(
    new Set(art.map((a) => a.id)),
    requestedIds,
    'Every requested artwork must exist and match the selected topic/source filters',
  );
const targets = [
  ...new Map(
    (process.env.ALL_RASTER === '1' || requestedIds.size
      ? art
      : process.env.RASTER_PER_TOPIC === '1'
        ? [
            ...[...new Set(art.map((a) => a.topic))].map((topic) =>
              art.find((a) => a.topic === topic),
            ),
            // A smaller source can have a less compressible alpha mask than
            // the largest PDF. Exercise every file with under 5 KB headroom.
            ...art.filter((a) => a.files.pdf.bytes > 995_000),
            [...art].sort((a, b) => b.files.pdf.bytes - a.files.pdf.bytes)[0],
          ]
        : [
            art[0],
            art.find((a) => a.style === 'Watercolor'),
            [...art].sort((a, b) => b.files.pdf.bytes - a.files.pdf.bytes)[0],
          ]
    )
      .filter(Boolean)
      .map((a) => [a.id, a]),
  ).values(),
];
const browser = await { chromium, firefox, webkit }[engine].launch({
  headless: true,
  ...(process.env.BROWSER_BIN ? { executablePath: process.env.BROWSER_BIN } : {}),
});
const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
const report = { base, engine, status: 'running', checks: [], states: [], exports: [], errors: [] };
page.on('pageerror', (e) => report.errors.push(e.message));
async function commitInput(selector, value) {
  await page.locator(selector).fill(String(value));
  await page.locator(selector).press('Tab');
}
async function save(kind, id) {
  await page.locator('[data-action=export]').click();
  await page.locator(`[data-format][value=${kind}]`).check();
  const pending = page.waitForEvent('download', { timeout: 60000 });
  await page.locator('[data-action=download]').click();
  const result = await pending;
  const path = resolve(out, `${id}-edited.${kind}`);
  await result.saveAs(path);
  assert.ok(statSync(path).size > 1000);
  if (kind === 'pdf') assert.ok(statSync(path).size <= 1_000_000);
  await page.locator('[data-action=close-export]').click();
  return { id, kind, bytes: statSync(path).size, path };
}
try {
  for (const [index, a] of targets.entries()) {
    await page.goto(base + `/edit/${a.id}/`);
    await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true', {
      timeout: 30000,
    });
    await expect(page.locator('.uc-canvas image')).toHaveCount(1);
    await page.locator('.uc-canvas image').evaluate(
      (img) =>
        new Promise((resolve, reject) => {
          const i = new Image();
          i.onload = resolve;
          i.onerror = reject;
          i.src = img.getAttribute('href');
        }),
    );
    await page.locator('[data-work-mode=advanced]').click();
    await page.locator('[data-panel=transform]').click();
    await commitInput('[data-prop=scaleX]', 70);
    await commitInput('[data-prop=scaleY]', 70);
    await commitInput('[data-prop=x]', 150);
    await commitInput('[data-prop=y]', 110);
    await commitInput('[data-prop=angle]', 8);
    const imageCount = index === 0 ? 2 : 1;
    if (index === 0) {
      await page.locator('[data-action=duplicate]').filter({ visible: true }).first().click();
      await commitInput('[data-prop=scaleX]', 35);
      await commitInput('[data-prop=scaleY]', 35);
      await commitInput('[data-prop=x]', Math.round(a.width * 0.54));
      await commitInput('[data-prop=y]', 250);
      await page.locator('[data-panel=color]').click();
      await page.locator('[data-prop=opacity]').evaluate((input) => {
        input.value = '45';
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await expect(page.locator('.uc-canvas image')).toHaveCount(2);
    }
    await page.locator('[data-panel=text]').click();
    await page.locator('[data-text]').fill('Play together');
    await page.locator('[data-text-size]').fill('80');
    await page.locator('[data-action=text]').click();
    await expect(page.locator('.uc-canvas text')).toContainText('Play together');
    await page.locator('[data-panel=transform]').click();
    await commitInput('[data-prop=x]', 120);
    await commitInput('[data-prop=y]', Math.round(a.height * 0.82));
    await page.locator('[data-panel=create]').click();
    await page.locator('[data-shape=star]').click();
    await expect(page.locator('.uc-canvas [data-layer]')).toHaveCount(imageCount + 2);
    await page.locator('[data-action=undo]').click();
    await expect(page.locator('.uc-canvas [data-layer]')).toHaveCount(imageCount + 1);
    await page.locator('[data-action=redo]').click();
    await expect(page.locator('.uc-canvas [data-layer]')).toHaveCount(imageCount + 2);
    await page.locator('[data-panel=crop]').click();
    await commitInput('[data-crop=x]', 50);
    await commitInput('[data-crop=y]', 60);
    await commitInput('[data-crop=width]', a.width - 132);
    await commitInput('[data-crop=height]', a.height - 182);
    await page.locator('[data-action=crop]').click();
    await page.locator('[data-panel=background]').click();
    await page.locator('[data-bg="#edf1e7"]').click();
    const projectPending = page.waitForEvent('download');
    await page.locator('[data-action=save]').click();
    const project = await projectPending;
    await project.saveAs(resolve(out, `${a.id}-project.json`));
    const data = JSON.parse(readFileSync(resolve(out, `${a.id}-project.json`)));
    assert.equal(data.layers.filter((l) => l.kind === 'raster').length, imageCount);
    assert.ok(JSON.stringify(data).length < 10000);
    assert.equal(data.layers[0].sourceSha256, a.files.webp.sha256);
    await page.reload();
    await expect(page.locator('.uc-canvas [data-layer]')).toHaveCount(imageCount + 2, {
      timeout: 30000,
    });
    report.exports.push(await save('pdf', a.id));
    report.exports.push(await save('webp', a.id));
    report.checks.push(a.id);
    if (index === 0)
      await page.screenshot({ path: resolve(out, 'edited-desktop.png'), fullPage: false });
  }
  const altered = Buffer.from(readFileSync(new URL('../../public' + art[0].webp, import.meta.url)));
  altered[altered.length - 1] ^= 1;
  const sourceRequest = (url) => url.pathname.includes(art[0].id) && url.pathname.endsWith('.webp');
  await page.route(sourceRequest, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/webp',
      headers: { 'access-control-allow-origin': '*' },
      body: altered,
    }),
  );
  await page.goto(base + `/edit/${art[0].id}/`);
  await expect(page.locator('[data-status]')).toContainText('verification failed', {
    timeout: 30000,
  });
  await expect(page.locator('.uc-canvas image')).toHaveCount(0);
  await expect(page.locator('[data-action=export]')).toBeDisabled();
  report.checks.push('changed source bytes are blocked before editing and export');
  await page.unroute(sourceRequest);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + `/edit/${art[0].id}/`);
    await expect(page.locator('.uc-canvas image')).toHaveCount(2, { timeout: 30000 });
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const row = {
      width,
      overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      violations: audit.violations.map((v) => v.id),
    };
    report.states.push(row);
    assert.equal(row.overflow, false);
    assert.deepEqual(row.violations, []);
    if (width === 390)
      await page.screenshot({ path: resolve(out, 'edited-mobile.png'), fullPage: false });
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  process.exitCode = 1;
  await page.screenshot({ path: resolve(out, 'failure.png'), fullPage: true }).catch(() => {});
} finally {
  writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, exports: report.exports.length }));
  await browser.close();
}
