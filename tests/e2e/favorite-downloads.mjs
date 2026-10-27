import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = process.env.BASE_URL || 'http://127.0.0.1:4323',
  engine = process.env.UC_BROWSER || 'chromium',
  out = `reports/favorite-downloads/${engine}`;
mkdirSync(out, { recursive: true });
const art = JSON.parse(readFileSync('data/art.json'))
  .filter((a) => a.published && a.indexable)
  .slice(0, 4);
const ids = art.map((a) => a.id);
function zipEntries(bytes) {
  const files = new Map();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(bytes.readUInt16LE(offset + 8), 0);
    const size = bytes.readUInt32LE(offset + 18),
      n = bytes.readUInt16LE(offset + 26),
      extra = bytes.readUInt16LE(offset + 28),
      start = offset + 30 + n + extra;
    files.set(
      bytes.subarray(offset + 30, offset + 30 + n).toString(),
      bytes.subarray(start, start + size),
    );
    offset = start + size;
  }
  return files;
}
const browser = await { chromium, webkit }[engine].launch(),
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    acceptDownloads: true,
  });
await context.addInitScript((ids) => {
  localStorage.setItem('ultraclipart-favorites', JSON.stringify(ids));
}, ids);
const page = await context.newPage(),
  report = { engine, downloads: [], errors: [], status: 'running' };
page.on('pageerror', (e) => report.errors.push(e.message));
try {
  await page.goto(base + '/favorites/');
  for (const format of ['webp', 'pdf']) {
    await page.locator(`[data-favorites-download=${format}]`).click();
    const dialog = page.locator('#favorites-download-dialog'),
      link = dialog.locator('[data-batch-download]');
    await expect(link).toBeVisible({ timeout: 120000 });
    const wait = page.waitForEvent('download');
    await link.click();
    const file = await wait;
    await file.saveAs(`${out}/${format}.zip`);
    const entries = zipEntries(readFileSync(`${out}/${format}.zip`)),
      manifest = JSON.parse(entries.get('download-manifest.json'));
    assert.equal(manifest.files.length, ids.length);
    for (const entry of manifest.files) {
      const data = entries.get(entry.name);
      assert.equal(data.length, entry.bytes);
      assert.equal(createHash('sha256').update(data).digest('hex'), entry.sha256);
    }
    await expect(dialog.locator('[data-batch-status]')).toContainText('4 verified files');
    await dialog.locator('[data-batch-close]').click();
    assert.deepEqual(
      await page.evaluate(() => JSON.parse(localStorage.getItem('ultraclipart-favorites'))),
      ids,
    );
    report.downloads.push({ format, files: manifest.files.length, hashesVerified: true });
  }
  await page.locator('[data-favorites-download=webp]').click();
  await page.locator('[data-batch-close]').click();
  await page.locator('[data-favorites-download=pdf]').click();
  await expect(page.locator('[data-batch-download]')).toBeVisible({ timeout: 120000 });
  await expect(page.locator('[data-batch-download]')).toHaveAttribute('download', /favorites-pdf/);
  await page.locator('[data-batch-close]').click();
  const requested = [];
  await page.route('**/catalog/**/*.webp', (route) => {
    requested.push(route.request().url());
    return requested.length === 2 ? route.abort('failed') : route.continue();
  });
  await page.locator('[data-favorites-download=webp]').click();
  await expect(page.locator('[data-batch-retry]')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#favorites-download-dialog progress')).toHaveJSProperty('value', 1);
  await page.locator('[data-batch-retry]').click();
  await expect(page.locator('[data-batch-download]')).toBeVisible({ timeout: 120000 });
  assert.equal(requested.filter((url) => url === requested[0]).length, 1);
  report.recovery = { cancelAndReopen: true, networkRetry: true, completedFileRetained: true };
  await page.screenshot({ path: `${out}/mobile.png` });
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  console.log(JSON.stringify(report));
} catch (error) {
  report.status = 'failed';
  report.failure = String(error);
  await page.screenshot({ path: `${out}/failure.png` });
  throw error;
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
