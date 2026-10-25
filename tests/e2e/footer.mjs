import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const engine = process.env.UC_BROWSER || 'chromium',
  base = process.env.BASE_URL || 'http://127.0.0.1:4381',
  output = `reports/footer/${engine}`;
mkdirSync(output, { recursive: true });
const browser = await { chromium, firefox, webkit }[engine].launch();
const context = await browser.newContext();
await context.route('**/*', (route) => route.continue());
const page = await context.newPage();
const report = { engine, layouts: [], destinations: [], errors: [] };
page.on('pageerror', (e) => report.errors.push(e.message));
try {
  for (const width of [1440, 768, 390, 320])
    for (const route of [
      '/',
      '/favorites/',
      '/art/apple-and-dried-rings-crayon-clipart/',
      '/art/usb-flash-drive-artist-usb-drive-and-sketchbook-arrangement/',
    ]) {
      await page.setViewportSize({ width, height: 1000 });
      const response = await page.goto(base + route);
      assert.equal(response.status(), 200);
      const footer = page.locator('.site-footer');
      await expect(footer).toHaveCount(1);
      await expect(footer).toHaveAttribute('data-ready', 'true');
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
      const groups = footer.locator('[data-footer-group]');
      await expect(groups).toHaveCount(4);
      assert.equal(await footer.locator('[data-footer-group][open]').count(), width > 600 ? 4 : 0);
      if (width <= 600) {
        await groups.first().locator('summary').click();
        await expect(groups.first()).toHaveAttribute('open', '');
        await expect(
          groups.first().getByRole('link', { name: 'Your boards', exact: true }),
        ).toBeVisible();
        await groups.first().locator('summary').focus();
        await page.keyboard.press('Enter');
        await expect(groups.first()).not.toHaveAttribute('open', '');
      }
      await expect(
        footer.getByRole('link', { name: 'Your boards', exact: true, includeHidden: true }),
      ).toHaveAttribute('href', '/favorites/');
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
  const sculptures = await page
    .locator('.site-footer img[src^="/illustrations/footer/"]')
    .evaluateAll((images) => [...new Set(images.map((image) => image.getAttribute('src')))]);
  assert.equal(sculptures.length, 5);
  for (const path of sculptures) {
    const response = await page.request.get(base + path);
    assert.equal(response.status(), 200, path);
    assert.match(response.headers()['content-type'], /^image\/svg\+xml/);
    const svg = await response.text();
    assert.match(svg, /<(linear|radial)Gradient/);
    assert.doesNotMatch(svg, /<script|<image|\bonload\s*=/i);
  }
  await page.locator('.site-footer a[href="#page-top"]').click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
  const noJsContext = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 900 },
  });
  try {
    const noJs = await noJsContext.newPage();
    await noJs.goto(base + '/');
    const footer = noJs.locator('.site-footer');
    await expect(footer.locator('[data-footer-group][open]')).toHaveCount(4);
    await expect(footer.getByRole('link', { name: 'Your boards', exact: true })).toBeVisible();
    await footer.locator('[data-footer-group]').first().locator('summary').click();
    await expect(footer.locator('[data-footer-group][open]')).toHaveCount(3);
  } finally {
    await noJsContext.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  console.log(JSON.stringify(report));
} finally {
  writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
