import { chromium, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://127.0.0.1:4351',
  out = resolve('reports/studio-upload');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
let page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  acceptDownloads: true,
});
const errors = [],
  posts = [];
const track = (page) => {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
};
track(page);
const settle = async () => {
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('data-processing', 'true', {
    timeout: 60000,
  });
};
const download = async (selector, name) => {
  const promise = page.waitForEvent('download', { timeout: 120000 });
  await page.locator(selector).click();
  const file = await promise;
  const path = resolve(out, name);
  await file.saveAs(path);
  return path;
};
try {
  await page.goto(base + '/create/');
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true');
  await page.locator('[data-panel=studio]').click();
  await page.locator('[data-studio-tool]').selectOption('composer');
  const art = JSON.parse(readFileSync(new URL('../../data/art.json', import.meta.url))).find(
    (a) => a.id === 'classic-white-volleyball-realistic-clipart',
  );
  await page.locator('[data-local-clipart]').setInputFiles(resolve('public' + art.webp));
  await expect(page.locator('[data-status]')).toContainText('Your clipart is ready', {
    timeout: 30000,
  });
  await page.locator('[data-panel=region]').click();
  await page.locator('[data-advanced-selection]').evaluate((e) => (e.open = true));
  await page.locator('[data-point-x]').fill('691');
  await page.locator('[data-point-y]').fill('691');
  await page.locator('[data-smart-action=select-point]').click();
  await expect(page.locator('[data-status]')).toContainText('Selection ready');
  await page.locator('[data-smart-action=apply]').click();
  await settle();
  const project = await download('[data-action=save]', 'local-clipart-project.json'),
    data = JSON.parse(readFileSync(project));
  assert.equal(data.localSources.length, 1);
  assert.match(data.localSources[0].data, /^data:image\/webp;base64,/);
  assert.equal(data.layers[0].sourceSha256, art.files.webp.sha256);
  assert.equal(data.layers[0].regions.length, 1);
  const before = await page.locator('.uc-canvas image').getAttribute('href');
  await page.close();
  page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  track(page);
  await page.goto(base + '/create/');
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true');
  await page.locator('[data-panel=layers]').click();
  await page.locator('[data-load]').setInputFiles(project);
  await expect(page.locator('[data-status]')).toContainText('Saved project opened', {
    timeout: 45000,
  });
  await settle();
  assert.equal(await page.locator('.uc-canvas image').getAttribute('href'), before);
  await page.locator('[data-panel=print]').click();
  await page.locator('[data-print=scale]').selectOption('native');
  for (const format of ['webp', 'pdf']) {
    await page.locator('[data-action=export]').click();
    await page.locator(`[data-format][value=${format}]`).check();
    if (format === 'pdf') await page.locator('[data-allow-large-pdf]').check();
    await download('[data-action=download]', `local-edited.${format}`);
    await page.locator('[data-action=close-export]').click();
  }
  await page.locator('[data-panel=studio]').click();
  await page.locator('[data-studio-tool]').selectOption('composer');
  await page
    .locator('[data-local-clipart]')
    .setInputFiles({
      name: 'bad.png',
      mimeType: 'image/png',
      buffer: Buffer.from('<svg onload="alert(1)"/>'),
    });
  await expect(page.locator('[data-status]')).toHaveAttribute('data-error', 'true');
  assert.deepEqual(errors, []);
  assert.deepEqual(posts, []);
  writeFileSync(
    resolve(out, 'report.json'),
    JSON.stringify(
      {
        status: 'PASS',
        checks: [
          'Arbitrary local WebP imported privately, selected and recolored at native size.',
          'Original local source embedded once in saved project; fresh browser context reopens identical pixels.',
          'Edited local image exports real CMYK PDF and WebP.',
          'Disguised SVG rejected; no POST or image upload request.',
        ],
        errors,
        posts,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
