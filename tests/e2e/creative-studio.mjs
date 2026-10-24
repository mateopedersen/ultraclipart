import { chromium, webkit, firefox, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { PDFDocument } from 'pdf-lib';
const base = process.env.BASE_URL || 'http://127.0.0.1:4353',
  engine = process.env.UC_BROWSER || 'chromium';
const out = path.resolve(process.env.EVIDENCE_DIR || 'reports/creative-studio', engine);
await fs.mkdir(out, { recursive: true });
const source = await fs.readFile(new URL('../../src/editor/elements.ts', import.meta.url), 'utf8');
const { studioElements } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')
);
const browser = await { chromium, webkit, firefox }[engine].launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
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
const panel = async (s) => page.locator(`[data-panel="${s}"]`).click();
const download = async (format, name) => {
  await action('export').click();
  await page.locator(`[data-format][value="${format}"]`).locator('..').click();
  const wait = page.waitForEvent('download', { timeout: 60000 });
  await action('download').click();
  const item = await wait;
  const file = path.join(out, name);
  await item.saveAs(file);
  const bytes = await fs.readFile(file);
  if (format === 'pdf') {
    expect(bytes.length).toBeLessThanOrEqual(1000000);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  } else {
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
  }
  exports.push({ file: name, bytes: bytes.length });
  await action('close-export').click();
};
try {
  await page.goto(`${base}/create/`);
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('main h1')).toHaveCount(1);
  await page.screenshot({ path: path.join(out, 'page-desktop.png') });
  await page.locator('[data-studio-launch=elements]').first().click();
  await page.locator('[data-library-kind=vector]').click();
  await expect(page.locator('[data-element-count]')).toHaveText('24 of 276 elements');
  expect(await page.locator('[data-element]').count()).toBe(24);
  await page.locator('[data-element-search]').fill('rainbow');
  await expect(page.locator('[data-element]')).toHaveCount(1);
  await page.locator('[data-element]').click();
  expect((await state()).layers).toHaveLength(1);
  await page.locator('.uc-element-favorite').click();
  await page.locator('[data-element-search]').fill('');
  await page.locator('[data-element-favorites]').click();
  await expect(page.locator('[data-element]')).toHaveCount(1);
  await page.reload();
  await panel('elements');
  await page.locator('[data-library-kind=vector]').click();
  await page.locator('[data-element-favorites]').click();
  await expect(page.locator('[data-element]')).toHaveCount(1);
  await page.locator('[data-element-favorites]').click();
  await page.locator('[data-element-category]').selectOption('Animals');
  expect(await page.locator('[data-element]').count()).toBeGreaterThanOrEqual(6);
  await page.locator('[data-element]').first().click();
  expect((await state()).layers).toHaveLength(2);
  await action('undo').click();
  expect((await state()).layers).toHaveLength(1);
  await action('redo').click();
  expect((await state()).layers).toHaveLength(2);
  checks.push(
    'library lazy loading, search, categories, favorites persistence, add, undo and redo',
  );
  await panel('layers');
  await page.locator('[data-select]').first().click();
  const beforeParts = await page.locator('[data-artwork-canvas]').screenshot();
  await action('separate-parts').click();
  expect((await state()).layers.length).toBeGreaterThan(2);
  const afterParts = await page.locator('[data-artwork-canvas]').screenshot();
  expect(afterParts.equals(beforeParts)).toBe(true);
  await action('undo').click();
  expect((await state()).layers).toHaveLength(2);
  checks.push('separate parts preserves exact canvas pixels and is reversible');
  await panel('text');
  await page.locator('[data-text-preset=editorial]').click();
  await page.locator('[data-text]').fill('Creative\nStudio');
  await page.locator('[data-text-decoration]').selectOption('underline');
  await action('new-text').click();
  let text = (await state()).layers.at(-1);
  expect(text.typography.font).toBe('serif');
  expect(text.typography.italic).toBe(true);
  expect(text.typography.decoration).toBe('underline');
  await page.locator('[data-text-layout]').selectOption('arc');
  await expect(page.locator('[data-text-radius]')).toBeVisible();
  await page.locator('[data-text-radius]').fill('180');
  await page.locator('[data-text-spacing]').fill('2');
  await action('text').click();
  text = (await state()).layers.at(-1);
  expect(text.typography.layout).toBe('arc');
  expect(text.typography.radius).toBe(180);
  await page.locator('[data-text-layout]').selectOption('circle');
  await action('text').click();
  expect((await state()).layers.at(-1).typography.layout).toBe('circle');
  await action('undo').click();
  expect((await state()).layers.at(-1).typography.layout).toBe('arc');
  await page.locator('[data-text-layout]').selectOption('straight');
  await action('text').click();
  await download('webp', 'text-and-elements.webp');
  await download('pdf', 'text-and-elements.pdf');
  checks.push(
    'editable serif italic, underline, multiline, spacing, curve/circle, history, WebP and PDF',
  );
  const project = {
    version: 2,
    artId: 'my-clipart',
    width: 1024,
    height: 1280,
    background: 'transparent',
    crop: null,
    print: { paper: 'letter', orientation: 'portrait', margin: 0.5, scale: 'fit' },
    layers: studioElements.map((e, i) => ({
      id: `e-${i}`,
      label: e.name,
      kind: 'vector',
      markup: e.markup,
      visible: true,
      locked: false,
      opacity: 1,
      x: 8 + (i % 16) * 63,
      y: 8 + Math.floor(i / 16) * 65,
      scaleX: 0.21,
      scaleY: 0.21,
      angle: 0,
    })),
  };
  await panel('layers');
  const started = Date.now();
  await page.locator('[data-load]').setInputFiles({
    name: '276-elements.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('[data-status]')).toContainText('project opened');
  expect((await state()).layers).toHaveLength(276);
  const loadMs = Date.now() - started;
  await page.locator('[data-work-mode=quick]').click();
  await page.locator('[data-work-mode=advanced]').click();
  expect((await state()).layers).toHaveLength(276);
  await panel('layers');
  await page.locator('[data-select=e-0]').click();
  await page.locator('[data-align-to]').selectOption('canvas');
  await page.locator('[data-arrange=center-x]').click();
  expect((await state()).layers[0].x).toBeGreaterThan(400);
  await action('undo').click();
  expect((await state()).layers[0].x).toBe(8);
  for (const id of ['e-0', 'e-1', 'e-2'])
    await page.locator(`[data-select=${id}]`).click({ modifiers: id === 'e-0' ? [] : ['Shift'] });
  await page.locator('[data-arrange=bottom]').click();
  await page.locator('[data-arrange=distribute-x]').click();
  expect((await state()).layers).toHaveLength(276);
  await action('undo').click();
  await action('undo').click();
  const wait = page.waitForEvent('download');
  await action('save').click();
  const saved = await wait;
  await saved.saveAs(path.join(out, '276-elements-project.json'));
  await page.reload();
  await expect(page.locator('[data-status]')).toContainText('restored');
  expect((await state()).layers).toHaveLength(276);
  await download('webp', 'all-276-elements.webp');
  await download('pdf', 'all-276-elements.pdf');
  checks.push(
    `276-layer import, align, distribute, save, reload, modes and export (${loadMs} ms import)`,
  );
  await panel('elements');
  await page.locator('[data-library-kind=vector]').click();
  await page.locator('[data-element-search]').fill('');
  await page.locator('#studio-workspace').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, 'workspace-desktop.png') });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await panel('text');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    const violations = (
      await new AxeBuilder({ page })
        .include('.creator-page')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
    ).violations;
    expect(violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
    if (width === 390) {
      await page.locator('[data-pane=text]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, 'text-mobile.png') });
    }
  }
  checks.push('320–1440px responsive overflow and WCAG automated checks');
  expect(errors).toEqual([]);
  await fs.writeFile(
    path.join(out, 'report.json'),
    JSON.stringify({ engine, base, checks, exports, errors }, null, 2),
  );
  console.log(JSON.stringify({ engine, checks, exports }, null, 2));
} catch (e) {
  await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true });
  console.error('Status:', await page.locator('[data-status]').textContent());
  throw e;
} finally {
  await browser.close();
}
