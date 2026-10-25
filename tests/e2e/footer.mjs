import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const engine = process.env.UC_BROWSER || 'chromium',
  base = process.env.BASE_URL || 'http://127.0.0.1:4381',
  output = `reports/footer/${engine}`;
mkdirSync(output, { recursive: true });
const browser = await { chromium, firefox, webkit }[engine].launch();
const page = await browser.newPage();
const report = { engine, layouts: [], destinations: [], errors: [] };
page.on('pageerror', (e) => report.errors.push(e.message));
try {
  for (const width of [1440, 768, 390, 320])
    for (const route of [
      '/',
      '/favorites/',
      '/art/apple-and-dried-rings-crayon-clipart/',
      '/download/usb-flash-drive-artist-usb-drive-and-sketchbook-arrangement/?format=pdf',
    ]) {
      await page.setViewportSize({ width, height: 1000 });
      const response = await page.goto(base + route);
      assert.equal(response.status(), 200);
      const footer = page.locator('.site-footer');
      await expect(footer).toHaveCount(1);
      await footer.scrollIntoViewIfNeeded();
      await footer.locator('img').evaluateAll(async (images) =>
        Promise.all(
          images.map(async (img) => {
            img.loading = 'eager';
            await img.decode();
          }),
        ),
      );
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      const bounds = await footer.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
      await expect(footer.getByRole('link', { name: 'Your boards', exact: true })).toHaveAttribute(
        'href',
        '/favorites/',
      );
      const scan = await new AxeBuilder({ page })
        .setLegacyMode(engine === 'webkit')
        .include('.site-footer')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      assert.deepEqual(
        scan.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
        [],
      );
      if (route === '/' && [1440, 390].includes(width))
        await footer.screenshot({ path: `${output}/footer-${width}.png` });
      report.layouts.push({ route, width, violations: 0 });
    }
  const links = await page
    .locator('.site-footer a')
    .evaluateAll((links) => [
      ...new Set(links.map((a) => a.getAttribute('href')).filter((url) => !url.startsWith('#'))),
    ]);
  for (const path of links) {
    const response = await page.request.get(base + path);
    assert.equal(response.status(), 200, path);
    report.destinations.push(path);
  }
  await page.locator('.site-footer a[href="#page-top"]').click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  console.log(JSON.stringify(report));
} finally {
  writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
