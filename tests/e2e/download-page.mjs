import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const engine = process.env.UC_BROWSER || 'chromium';
const base = process.env.BASE_URL || 'http://127.0.0.1:4381';
const catalog = JSON.parse(readFileSync('data/art.json'));
const publication = JSON.parse(readFileSync('data/publication.json'));
const output = `reports/download-page/${engine}`;
mkdirSync(output, { recursive: true });
const browser = await { chromium, firefox, webkit }[engine].launch();
const context = await browser.newContext({ acceptDownloads: true });
// Repeated viewport cases must request fresh HTML rather than conditional cache responses.
await context.route('**/*', (route) => route.continue());
const page = await context.newPage();
const report = { engine, base, layouts: [], downloads: [], errors: [], adRequests: [] };
page.on('pageerror', (e) => report.errors.push(e.message));
page.on('request', (r) => {
  if (/googlesyndication|doubleclick|googleadservices/.test(r.url()))
    report.adRequests.push(r.url());
});
try {
  for (const width of [1440, 768, 390, 320])
    for (const id of [
      'apple-and-dried-rings-crayon-clipart',
      'usb-flash-drive-artist-usb-drive-and-sketchbook-arrangement',
    ]) {
      await page.setViewportSize({ width, height: 1000 });
      const item = catalog.find((a) => a.id === id);
      const response = await page.goto(`${base}/download/${id}/?format=pdf`, {
        waitUntil: 'networkidle',
      });
      assert.equal(response.status(), 200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('[data-download-format]').first()).toHaveAttribute(
        'data-download-format',
        'pdf',
      );
      await expect(page.locator('[data-download-format="pdf"]')).toHaveAttribute(
        'data-selected',
        'true',
      );
      await expect(page.locator('[data-download-ad-region]')).toBeHidden();
      assert.equal(await page.locator('[data-final-download]').count(), 2);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      assert.equal(
        await page.locator('link[rel="canonical"]').getAttribute('href'),
        `https://ultraclipart.com/download/${id}/`,
      );
      assert.equal(
        await page.locator('meta[name="robots"]').getAttribute('content'),
        'noindex,follow',
      );
      const axe = await new AxeBuilder({ page })
        .setLegacyMode(engine === 'webkit')
        .include('.download-station')
        .include('.download-project-notes')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      assert.deepEqual(
        axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
        [],
      );
      for (const format of ['webp', 'pdf']) {
        const link = page.locator(`[data-final-download="${format}"]`);
        await expect(link).toHaveAttribute('data-expected-bytes', String(item.files[format].bytes));
        await expect(link).toHaveAttribute('data-expected-sha256', item.files[format].sha256);
        const box = await link.boundingBox();
        assert.ok(box.height >= 44 && box.x >= 0 && box.x + box.width <= width);
        if (width === 390) {
          const next = page.waitForEvent('download');
          await link.click();
          const download = await next;
          assert.equal(download.suggestedFilename(), `${id}.${format}`);
          const tempDir = mkdtempSync(join(tmpdir(), 'ultraclipart-download-page-'));
          try {
            const savedFile = join(tempDir, `${id}.${format}`);
            await download.saveAs(savedFile);
            const bytes = readFileSync(savedFile);
            assert.equal(await download.failure(), null);
            assert.equal(bytes.length, item.files[format].bytes);
            assert.equal(
              createHash('sha256').update(bytes).digest('hex'),
              item.files[format].sha256,
            );
            report.downloads.push({ id, format, bytes: bytes.length });
          } finally {
            await download.delete().catch(() => {});
            rmSync(tempDir, { recursive: true, force: true });
          }
        }
      }
      if (id.startsWith('usb-') && [1440, 390].includes(width))
        await page.screenshot({ path: `${output}/download-${width}.png`, fullPage: false });
      report.layouts.push({ id, width, accessibilityViolations: 0 });
    }
  // Gallery entry and related cards share the same route contract.
  await page.goto(`${base}/art/apple-and-dried-rings-crayon-clipart/`);
  const entry = page.locator('.detail-actions a[href$="?format=webp"]');
  await entry.click();
  await page.waitForURL('**/download/apple-and-dried-rings-crayon-clipart/**');
  await expect(page.locator('[data-download-format]').first()).toHaveAttribute(
    'data-download-format',
    'webp',
  );
  await page.goto(
    `${base}/download/apple-and-dried-rings-crayon-clipart/?format=%22%3E%3Cscript%3E`,
  );
  await expect(page.locator('[data-final-download]')).toHaveCount(2);
  // A CDN file must download with its original name rather than opening as an image.
  const original = page.locator('[data-final-download="webp"]'),
    item = catalog.find((a) => a.id === 'apple-and-dried-rings-crayon-clipart'),
    source = publication.files.find((file) => file.assetId === item.id && file.kind === 'webp').url,
    originalBytes = readFileSync('public' + item.webp),
    cors = { 'Access-Control-Allow-Origin': new URL(base).origin };
  let sourceRequests = 0;
  const validSource = (route) => {
    sourceRequests++;
    return route.fulfill({
      status: 200,
      contentType: 'image/webp',
      headers: cors,
      body: originalBytes,
    });
  };
  await context.route(source, validSource);
  await original.evaluate((link, url) => {
    link.href = url;
  }, source);
  const remoteEvents = [];
  const trackRemote = (download) => remoteEvents.push(download);
  page.on('download', trackRemote);
  const remoteDownload = page.waitForEvent('download');
  await original.click();
  const downloaded = await remoteDownload,
    remoteDir = mkdtempSync(join(tmpdir(), 'ultraclipart-cdn-download-'));
  try {
    const saved = join(remoteDir, `${item.id}.webp`);
    assert.equal(downloaded.suggestedFilename(), `${item.id}.webp`);
    await downloaded.saveAs(saved);
    assert.equal(
      createHash('sha256').update(readFileSync(saved)).digest('hex'),
      item.files.webp.sha256,
    );
  } finally {
    await downloaded.delete();
    rmSync(remoteDir, { recursive: true, force: true });
  }
  assert.equal(sourceRequests, 1, 'One click must fetch the original exactly once');
  assert.equal(remoteEvents.length, 1, 'One click must create exactly one download');
  page.off('download', trackRemote);
  // Corrupt CDN bytes must never be handed to the browser download manager.
  const unexpected = [];
  const track = (download) => unexpected.push(download);
  page.on('download', track);
  const corruptSource = (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/webp',
      headers: cors,
      body: Buffer.alloc(item.files.webp.bytes),
    });
  await context.route(source, corruptSource);
  await original.click();
  await expect(page.locator('[data-download-format="webp"] [data-download-status]')).toContainText(
    'We couldn’t verify this download',
  );
  assert.equal(unexpected.length, 0);
  await expect(original).not.toHaveAttribute('aria-busy', 'true');
  await context.unroute(source, corruptSource);
  const retry = page.waitForEvent('download');
  await original.click();
  await (await retry).delete();
  await context.unroute(source, validSource);
  page.off('download', track);
  await expect(page.locator('[data-download-format="webp"] [data-download-status]')).toContainText(
    'Original file verified',
  );
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const plain = await nojs.newPage();
  await plain.goto(`${base}/art/apple-and-dried-rings-crayon-clipart/`);
  await plain.locator('.detail-actions a[href$="?format=pdf"]').click();
  await plain.waitForURL('**/download/apple-and-dried-rings-crayon-clipart/**');
  await expect(plain.locator('[data-final-download]')).toHaveCount(2);
  await nojs.close();
  assert.deepEqual(report.adRequests, []);
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  console.log(JSON.stringify(report));
} finally {
  writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
