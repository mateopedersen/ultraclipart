import { installProductionCsp } from '../helpers/production-csp.mjs';
import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
const engine = process.env.UC_BROWSER || 'chromium',
  base = process.env.BASE_URL || 'http://127.0.0.1:4323';
const out = `reports/studio-export/${engine}`;
mkdirSync(out, { recursive: true });
function storedZipEntries(bytes) {
  const files = new Map();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(bytes.readUInt16LE(offset + 8), 0, 'Package uses stored ZIP entries');
    const size = bytes.readUInt32LE(offset + 18),
      nameLength = bytes.readUInt16LE(offset + 26),
      extraLength = bytes.readUInt16LE(offset + 28);
    const name = bytes.subarray(offset + 30, offset + 30 + nameLength).toString();
    const start = offset + 30 + nameLength + extraLength;
    assert.ok(!files.has(name));
    files.set(name, bytes.subarray(start, start + size));
    offset = start + size;
  }
  assert.equal(files.size, 6);
  return files;
}
const png = await sharp({
  create: { width: 32, height: 32, channels: 4, background: { r: 20, g: 100, b: 212, alpha: 1 } },
})
  .png()
  .toBuffer();
const sha = createHash('sha256').update(png).digest('hex'),
  assetId = 'local-' + sha;
const fixture = {
  version: 2,
  artId: 'my-clipart',
  width: 800,
  height: 600,
  background: 'transparent',
  crop: null,
  print: { paper: 'a4', orientation: 'landscape', margin: 0.5, scale: 'fit' },
  localSources: [
    { id: assetId, sha256: sha, data: 'data:image/png;base64,' + png.toString('base64') },
  ],
  layers: [
    {
      id: 'shape',
      kind: 'vector',
      label: 'Blue rectangle',
      markup: '<rect width="180" height="110" rx="15" fill="#1464d4"/>',
      x: 80,
      y: 100,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      visible: true,
      locked: false,
      opacity: 1,
    },
    {
      id: 'text',
      kind: 'text',
      label: 'Text',
      text: 'Our creative project',
      size: 35,
      color: '#153250',
      bold: true,
      align: 'start',
      x: 90,
      y: 360,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      visible: true,
      locked: false,
      opacity: 1,
    },
    {
      id: 'image',
      kind: 'raster',
      label: 'Test image',
      assetId,
      sourceSha256: sha,
      width: 32,
      height: 32,
      x: 420,
      y: 80,
      scaleX: 5,
      scaleY: 5,
      angle: 0,
      visible: true,
      locked: false,
      opacity: 1,
    },
  ],
};
const browser = await { chromium, webkit }[engine].launch(),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
await context.addInitScript(() => {
  new MutationObserver((records) => {
    for (const r of records)
      for (const node of r.addedNodes)
        if (node instanceof HTMLIFrameElement && node.title === 'Print artwork')
          node.contentWindow.print = () => {
            window.__print = {
              title: node.contentDocument.title,
              style: node.contentDocument.querySelector('style')?.textContent,
              loaded: node.contentDocument.querySelector('img')?.complete,
            };
          };
  }).observe(document, { childList: true, subtree: true });
});
const page = await context.newPage(),
  report = { engine, exports: [], checks: [], errors: [], status: 'running' };
if (process.env.EXPORT_CSP === '1') await installProductionCsp(page);
page.on('pageerror', (e) => report.errors.push(e.message));
try {
  await page.goto(base + '/create/');
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true', {
    timeout: 60000,
  });
  await page.locator('[data-load]').setInputFiles({
    name: 'fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await expect(page.locator('[data-status]')).toHaveText('Saved project opened.');
  await page.locator('[data-action=export]').click();
  const dialog = page.locator('[data-export-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-format]')).toHaveCount(6);
  await dialog.locator('[data-filename]').fill('Çiçek & Yıldız 2026');
  await dialog.locator('[data-filename]').press('Tab');
  await expect(page.locator('.uc-command h2')).toHaveText('Çiçek & Yıldız 2026');
  await dialog.locator('.uc-format-choices').screenshot({ path: `${out}/formats.png` });
  for (const format of ['png', 'jpg', 'webp', 'svg', 'docx', 'pdf']) {
    await dialog.locator(`[data-format][value=${format}]`).check({ force: true });
    if (['png', 'jpg', 'webp'].includes(format))
      await dialog.locator('[data-size]').selectOption('1024');
    if (format === 'pdf') await dialog.locator('[data-allow-large-pdf]').check();
    const waiting = page.waitForEvent('download', { timeout: 60000 });
    await dialog.locator('[data-action=download]').click();
    const download = await waiting;
    assert.equal(download.suggestedFilename().normalize('NFC'), `Çiçek & Yıldız 2026.${format}`);
    const path = `${out}/design.${format}`;
    await download.saveAs(path);
    const bytes = readFileSync(path);
    if (['png', 'jpg', 'webp'].includes(format)) {
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.width, 1024);
      assert.equal(metadata.height, 768);
      assert.equal(metadata.format, format === 'jpg' ? 'jpeg' : format);
      const { data, info } = await sharp(bytes)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      assert.equal(data[3], format === 'jpg' ? 255 : 0);
      report.exports.push({
        format,
        bytes: bytes.length,
        width: metadata.width,
        height: metadata.height,
        alpha: metadata.hasAlpha,
      });
    }
    if (format === 'svg') {
      const svg = bytes.toString();
      assert.ok(svg.includes('data:image/png;base64,'));
      assert.ok(!svg.includes('blob:'));
      assert.ok(svg.includes('Çiçek &amp; Yıldız 2026'));
      report.exports.push({ format, bytes: bytes.length, embeddedRaster: true });
    }
    if (format === 'pdf') {
      const pdf = await PDFDocument.load(bytes);
      assert.equal(pdf.getPageCount(), 1);
      assert.equal(pdf.getTitle(), 'Çiçek & Yıldız 2026');
      const size = pdf.getPage(0).getSize();
      assert.ok(size.width > size.height);
      report.exports.push({ format, bytes: bytes.length, pages: 1, title: pdf.getTitle() });
    }
    if (format === 'docx') {
      const files = storedZipEntries(bytes),
        document = files.get('word/document.xml').toString();
      assert.ok(document.includes('behindDoc="0"'));
      assert.ok(document.includes('w:orient="landscape"'));
      assert.ok(
        files.get('word/_rels/document.xml.rels').toString().includes('Target="media/artwork.png"'),
      );
      assert.ok(
        !files.get('word/_rels/document.xml.rels').toString().includes('TargetMode="External"'),
      );
      assert.ok(files.get('docProps/core.xml').toString().includes('Çiçek &amp; Yıldız 2026'));
      const image = await sharp(files.get('word/media/artwork.png')).metadata();
      assert.equal(image.format, 'png');
      assert.ok(image.width > image.height);
      report.exports.push({
        format,
        bytes: bytes.length,
        packageParts: files.size,
        embeddedImage: [image.width, image.height],
      });
    }
  }
  await dialog.locator('[data-action=print-design]').click();
  await expect
    .poll(() => page.evaluate(() => window.__print?.title), { timeout: 30000 })
    .toBe('Çiçek & Yıldız 2026');
  assert.equal(await page.evaluate(() => window.__print.loaded), true);
  report.checks.push(
    'Print page prepared with project title and loaded artwork; print handoff intercepted',
  );
  await page.screenshot({ path: `${out}/desktop.png` });
  await dialog.locator('[data-action=close-export]').click();
  await page.locator('.wb-file-menu summary').click();
  const projectWaiting = page.waitForEvent('download');
  await page.locator('.wb-file-menu [data-action=save]').click();
  const project = await projectWaiting;
  assert.equal(project.suggestedFilename().normalize('NFC'), 'Çiçek & Yıldız 2026-project.json');
  await project.saveAs(`${out}/project.json`);
  assert.equal(JSON.parse(readFileSync(`${out}/project.json`)).title, 'Çiçek & Yıldız 2026');
  await page.reload();
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true', {
    timeout: 60000,
  });
  await page.locator('[data-action=export]').click();
  await expect(dialog.locator('[data-filename]')).toHaveValue('Çiçek & Yıldız 2026');
  await expect(dialog.locator('[data-format][value=pdf]')).toBeChecked();
  await dialog.locator('[data-filename]').fill('');
  await dialog.locator('[data-action=download]').click();
  await expect(dialog.locator('[data-export-status]')).toHaveText(
    'Enter a project name before downloading or printing.',
  );
  await dialog.locator('[data-filename]').fill('Safe / filename : 2026.png');
  await dialog.locator('[data-format][value=png]').check({ force: true });
  const safeWaiting = page.waitForEvent('download');
  await dialog.locator('[data-action=download]').click();
  const safe = await safeWaiting;
  assert.equal(safe.suggestedFilename().normalize('NFC'), 'Safe filename 2026.png');
  report.checks.push(
    'Names persist in project and preferences; empty and unsafe filenames handled',
  );
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-action=download]')).toBeInViewport();
    await expect(dialog.locator('[data-action=print-design]')).toBeInViewport();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.equal(await dialog.evaluate((el) => el.scrollWidth > el.clientWidth + 1), false);
    await page.screenshot({ path: `${out}/mobile-${width}.png` });
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  console.log(JSON.stringify(report));
} catch (e) {
  report.status = 'failed';
  report.failure = String(e);
  await page.screenshot({ path: `${out}/failure.png` });
  throw e;
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
