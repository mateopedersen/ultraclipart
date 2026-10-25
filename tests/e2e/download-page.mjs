import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const engine = process.env.UC_BROWSER || 'chromium';
const upstream = process.env.BASE_URL || 'http://127.0.0.1:4381';
const base = 'https://ultraclipart.com';
const catalog = JSON.parse(readFileSync('data/art.json'));
const output = `reports/download-page/${engine}`;
mkdirSync(output, { recursive: true });
const browser = await { chromium, firefox, webkit }[engine].launch();
const context = await browser.newContext({ acceptDownloads: true });
await context.route('**/*', (route) => route.continue());
if (upstream !== base)
  await context.route(`${base}/**`, async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${upstream}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
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
          const bytes = readFileSync(await download.path());
          assert.equal(bytes.length, item.files[format].bytes);
          assert.equal(createHash('sha256').update(bytes).digest('hex'), item.files[format].sha256);
          await download.delete();
          report.downloads.push({ id, format, bytes: bytes.length });
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
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  if (upstream !== base)
    await nojs.route(`${base}/**`, async (route) => {
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: `${upstream}${url.pathname}${url.search}` });
      await route.fulfill({ response });
    });
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
