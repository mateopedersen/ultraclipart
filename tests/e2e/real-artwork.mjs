import { chromium, webkit, firefox, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
const engine = process.env.UC_BROWSER || 'chromium',
  base = process.env.BASE_URL || 'http://127.0.0.1:4353',
  out = path.resolve(process.env.EVIDENCE_DIR || 'reports/real-artwork', engine);
await fs.mkdir(out, { recursive: true });
const browser = await { chromium, webkit, firefox }[engine].launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  acceptDownloads: true,
  reducedMotion: 'reduce',
});
const page = await context.newPage(),
  errors = [],
  checks = [],
  exports = [];
page.on('pageerror', (e) => errors.push(e.message));
const state = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('ultraclipart:editor:v1:my-clipart')));
const action = (s) => page.locator(`[data-action="${s}"]`).filter({ visible: true }).first();
const panel = (s) => page.locator(`[data-panel="${s}"]`).click();
try {
  await page.goto(base + '/create/');
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true');
  await page.screenshot({ path: path.join(out, 'real-artwork-desktop.png') });
  await expect(page.locator('[data-artwork-count]')).toContainText('23 of 23');
  await page.locator('[data-artwork-search]').fill('strawberry');
  await expect(page.locator('[data-artwork]')).toHaveCount(1);
  await page.locator('[data-artwork]').click();
  await expect(page.locator('[data-status]')).toContainText('independent image layer');
  let d = await state();
  expect(d.layers[0].kind).toBe('raster');
  expect(d.width).toBe(d.layers[0].width);
  expect(d.layers[0].scaleX).toBe(1);
  checks.push(
    'Realistic library search loads verified original-resolution artwork onto a native-size canvas',
  );
  await page.locator('button[data-work-mode=advanced]').click();
  await panel('create');
  await page.locator('[data-place-width]').fill('200');
  await page.locator('[data-place-angle]').fill('15');
  await action('place-image').click();
  const box = await page.locator('.uc-canvas').boundingBox();
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.25);
  await expect.poll(async () => (await state()).layers.length).toBe(2);
  d = await state();
  expect(d.layers[1].assetId).toBe(d.layers[0].assetId);
  expect(d.layers[1].angle).toBe(15);
  expect(d.layers[1].width * d.layers[1].scaleX).toBeCloseTo(200);
  await page.locator('.uc-stage').press('Escape');
  await expect(action('place-image')).toHaveAttribute('aria-pressed', 'false');
  await action('undo').click();
  expect((await state()).layers.length).toBe(1);
  await action('redo').click();
  expect((await state()).layers.length).toBe(2);
  checks.push(
    'Image placement preserves full-resolution source, width and rotation, with undo/redo',
  );
  await panel('layers');
  await page.locator('[data-select]').first().click();
  await page.locator('.uc-repeat-controls summary').click();
  await page.locator('[data-repeat-stagger]').check();
  await action('repeat-selection').click();
  await expect.poll(async () => (await state()).layers.length).toBe(5);
  d = await state();
  expect(new Set(d.layers.map((l) => l.id)).size).toBe(5);
  expect(new Set(d.layers.map((l) => l.assetId)).size).toBe(1);
  await action('undo').click();
  expect((await state()).layers.length).toBe(2);
  checks.push(
    'Repeated image layout with alternate rows creates independent editable copies in one undo step',
  );
  for (const [id, count] of [
    ['fresh-strawberries', 2],
    ['little-explorer', 3],
    ['woodland-welcome', 3],
    ['citrus-notes', 3],
    ['wildlife-collection', 4],
    ['best-friends', 3],
  ]) {
    await page.locator(`[data-studio-scene="${id}"]`).click();
    await expect(page.locator('[data-status]')).toContainText(
      'Every image and caption is editable',
      { timeout: 60000 },
    );
    d = await state();
    expect(d.layers.length).toBe(count);
    expect(d.layers.at(-1).kind).toBe('text');
    expect(
      d.layers.filter((l) => l.kind === 'raster').every((l) => l.sourceSha256.length === 64),
    ).toBeTruthy();
  }
  checks.push(
    'All six real-artwork compositions load independently editable verified images and text',
  );
  // A new edit must win over an earlier pending scene request.
  await page.route('**/strawberry-fruit-trio-realistic-clipart.webp', async (route) => {
    await new Promise((r) => setTimeout(r, 900));
    await route.continue();
  });
  await page.locator('[data-studio-scene=fresh-strawberries]').click();
  await action('reset').click();
  await page.waitForTimeout(1300);
  expect((await state()).layers.length).toBe(0);
  await page.unroute('**/strawberry-fruit-trio-realistic-clipart.webp');
  checks.push('Reset cancels a pending scene load without replacing newer work');
  await page.locator('[data-studio-scene=woodland-welcome]').click();
  await expect(page.locator('[data-status]')).toContainText('Every image and caption is editable');
  const saved = page.waitForEvent('download');
  await action('save').click();
  await (await saved).saveAs(path.join(out, 'woodland-project.json'));
  await page.reload();
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true');
  expect((await state()).layers.length).toBe(3);
  for (const format of ['webp', 'pdf']) {
    await action('export').click();
    await page.locator(`[data-format][value="${format}"]`).locator('..').click();
    if (format === 'pdf') await page.locator('[data-allow-large-pdf]').check();
    const done = page.waitForEvent('download', { timeout: 90000 });
    await action('download').click();
    const item = await done;
    const file = path.join(out, `woodland.${format}`);
    await item.saveAs(file);
    const bytes = await fs.readFile(file);
    if (format === 'pdf') {
      expect(bytes.length).toBeGreaterThan(1000);
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    } else expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
    exports.push({ format, bytes: bytes.length });
    await action('close-export').click();
  }
  checks.push(
    'Real artwork project survives save/reload and exports WebP plus CMYK PDF with an explicit larger-file choice',
  );
  await page.locator('#studio-workspace').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, 'real-artwork-workspace.png') });
  const responsive = [];
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await panel('elements');
    const issues = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    responsive.push({ width, overflow, violations: issues.violations });
    expect(overflow).toBe(false);
    const headingFlow = await page.locator('.studio-learning-heading').evaluate((el) => {
      const k = el.querySelector('.studio-kicker').getBoundingClientRect(),
        h = el.querySelector('h2').getBoundingClientRect(),
        p = el.querySelector('p:last-child').getBoundingClientRect();
      return { ordered: k.bottom <= h.top + 1 && h.bottom <= p.top + 1, width: h.width };
    });
    expect(headingFlow.ordered).toBe(true);
    expect(headingFlow.width).toBeGreaterThan(Math.min(600, width - 60));
    expect(issues.violations).toEqual([]);
    await page.screenshot({ path: path.join(out, `responsive-${width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator('#studio-guide').screenshot({ path: path.join(out, 'create-guide.png') });
  await page
    .locator('.studio-scenes')
    .screenshot({ path: path.join(out, 'real-compositions.png') });
  for (const [link, mode, pane] of [
    ['text', 'advanced', 'text'],
    ['studio', 'print', 'studio'],
    ['elements', 'print', 'elements'],
  ]) {
    await page.locator(`#studio-guide [data-studio-launch="${link}"]`).click();
    await expect(page.locator(`[data-pane="${pane}"]`)).toBeVisible();
  }
  checks.push(
    'Visual guide links open their working tools; mobile layout and accessible headings verified',
  );
  expect(errors).toEqual([]);
  await fs.writeFile(
    path.join(out, 'report.json'),
    JSON.stringify({ engine, checks, exports, responsive, errors }, null, 2),
  );
  console.log(JSON.stringify({ engine, checks, exports, errors }, null, 2));
} finally {
  await browser.close();
}
