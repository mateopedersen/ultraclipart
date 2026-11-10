import { chromium, webkit, firefox, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import {
  chooseScene,
  clickFileAction,
  installNecessaryCookieHandler,
} from '../helpers/creator.mjs';
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
await installNecessaryCookieHandler(page);
page.on('pageerror', (e) => errors.push(e.message));
const state = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('ultraclipart:editor:v1:my-clipart')));
const action = (s) => page.locator(`[data-action="${s}"]`).filter({ visible: true }).first();
const panel = (s) => page.locator(`[data-panel="${s}"]`).click();
try {
  await page.goto(base + '/create/');
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true');
  await page.screenshot({ path: path.join(out, 'real-artwork-desktop.png') });
  const studioCatalog = JSON.parse(
    await fs.readFile(path.resolve('dist/studio-catalog.json'), 'utf8'),
  );
  const featuredCount = studioCatalog.filter((item) => item.featured).length;
  expect(featuredCount).toBe(500);
  const featuredManifest = JSON.parse(
    await fs.readFile(path.resolve('dist/studio-featured.json'), 'utf8'),
  );
  const categories = featuredManifest.categories;
  expect(categories.length).toBeGreaterThan(0);
  await panel('elements');
  await expect(page.locator('[data-artwork-count]')).toHaveText(
    `${categories.length} categories — choose one to see its subjects`,
  );
  await expect(page.locator('.wb-category-tile')).toHaveCount(Math.min(6, categories.length));
  const category = categories[0];
  await page.locator('.wb-category-tile').first().click();
  await expect(page.locator('[data-artwork-count]')).toHaveText(
    `${category.topics.length} ${category.topics.length === 1 ? 'subject' : 'subjects'} in ${category.title}`,
  );
  await expect(page.locator('.wb-category-tile')).toHaveCount(Math.min(6, category.topics.length));
  const subject = category.topics[0];
  const subjectArtwork = studioCatalog.filter((item) => item.topic === subject.id);
  expect(subjectArtwork.length).toBe(subject.count);
  await page.locator('.wb-category-tile').first().click();
  await expect(page.locator('[data-artwork-topic]')).toHaveValue(subject.id);
  await expect(page.locator('[data-artwork-count]')).toHaveText(
    `1–${Math.min(6, subject.count)} of ${subject.count.toLocaleString('en-US')} artworks`,
  );
  await expect(page.locator('[data-artwork]')).toHaveCount(Math.min(6, subject.count));
  await page.locator('[data-artwork-scope=featured]').click();
  await expect(page.locator('[data-artwork-count]')).toHaveText(
    `1–6 of ${featuredCount.toLocaleString('en-US')} artworks`,
  );
  await expect(page.locator('[data-artwork]')).toHaveCount(6);
  const firstPageIds = await page
    .locator('[data-artwork]')
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-artwork')));
  await page.locator('[data-artwork-more]').click();
  await expect(page.locator('[data-artwork-count]')).toHaveText(
    `7–12 of ${featuredCount.toLocaleString('en-US')} artworks`,
  );
  await expect(page.locator('[data-artwork]')).toHaveCount(6);
  const secondPageIds = await page
    .locator('[data-artwork]')
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-artwork')));
  expect(new Set([...firstPageIds, ...secondPageIds]).size).toBe(12);
  await page.locator('[data-artwork-previous]').click();
  await expect(page.locator('[data-artwork-count]')).toHaveText(
    `1–6 of ${featuredCount.toLocaleString('en-US')} artworks`,
  );
  expect(
    await page
      .locator('[data-artwork]')
      .evaluateAll((items) => items.map((item) => item.getAttribute('data-artwork'))),
  ).toEqual(firstPageIds);
  checks.push(
    'Category, subject and featured artwork navigation uses exact manifest counts and independent paginated cards',
  );
  await page.locator('[data-artwork-search]').fill('Strawberry Fruit Trio Realistic');
  await page.locator('[data-artwork="strawberry-fruit-trio-realistic-clipart"]').click();
  await expect(page.locator('[data-status]')).toContainText('independent image layer');
  let d = await state();
  expect(d.layers[0].kind).toBe('raster');
  expect(d.width).toBe(d.layers[0].width);
  expect(d.layers[0].scaleX).toBe(1);
  checks.push(
    'Realistic library search loads verified original-resolution artwork onto a native-size canvas',
  );
  await page.locator('button[data-work-mode=edit]').click();
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
  for (const [id, counts] of [
    ['fresh-strawberries', { total: 17, raster: 1, text: 7, vector: 9 }],
    ['little-explorer', { total: 13, raster: 2, text: 3, vector: 8 }],
    ['woodland-welcome', { total: 10, raster: 2, text: 3, vector: 5 }],
    ['citrus-notes', { total: 12, raster: 2, text: 5, vector: 5 }],
    ['wildlife-collection', { total: 19, raster: 3, text: 9, vector: 7 }],
    ['best-friends', { total: 44, raster: 2, text: 12, vector: 30 }],
  ]) {
    await chooseScene(page, id);
    await expect(page.locator('[data-status]')).toContainText(
      'Every image and caption is editable',
      { timeout: 60000 },
    );
    d = await state();
    expect(d.width).toBe(1400);
    expect(d.height).toBe(1000);
    expect(d.layers).toHaveLength(counts.total);
    expect(new Set(d.layers.map((layer) => layer.id)).size).toBe(counts.total);
    for (const kind of ['raster', 'text', 'vector'])
      expect(d.layers.filter((layer) => layer.kind === kind)).toHaveLength(counts[kind]);
    for (const layer of d.layers.filter((item) => item.kind === 'raster')) {
      const source = studioCatalog.find((item) => item.id === layer.assetId);
      expect(source).toBeDefined();
      expect(layer.sourceSha256).toBe(source.webp.sha256);
    }
  }
  checks.push(
    'All six real-artwork compositions load independently editable verified images and text',
  );
  // A new edit must win over an earlier pending scene request.
  const strawberry = studioCatalog.find(
    (item) => item.id === 'strawberry-fruit-trio-realistic-clipart',
  );
  expect(strawberry).toBeDefined();
  const delayedUrl = new URL(strawberry.webp.url, base).href;
  let sourceStarted = false;
  let releaseSource;
  const sourceGate = new Promise((resolve) => {
    releaseSource = resolve;
  });
  await page.route(delayedUrl, async (route) => {
    sourceStarted = true;
    await sourceGate;
    await route.continue();
  });
  await chooseScene(page, 'fresh-strawberries');
  await expect.poll(() => sourceStarted).toBe(true);
  await clickFileAction(page, 'reset');
  expect((await state()).layers).toHaveLength(0);
  releaseSource();
  await expect(page.locator('[data-studio-scene=fresh-strawberries]')).not.toHaveAttribute(
    'aria-busy',
    'true',
  );
  expect((await state()).layers).toHaveLength(0);
  await page.unroute(delayedUrl);
  checks.push('Reset cancels a pending scene load without replacing newer work');
  await chooseScene(page, 'woodland-welcome');
  await expect(page.locator('[data-status]')).toContainText('Every image and caption is editable');
  const saved = page.waitForEvent('download');
  await clickFileAction(page, 'save');
  await (await saved).saveAs(path.join(out, 'woodland-project.json'));
  await page.reload();
  await page.locator('.uc-editor').scrollIntoViewIfNeeded();
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true');
  expect((await state()).layers).toHaveLength(10);
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
      const h = el.querySelector('h2').getBoundingClientRect(),
        p = el.querySelector('p:last-child').getBoundingClientRect();
      return {
        ordered: h.bottom <= p.top + 1,
        aligned: Math.abs(h.left - p.left) <= 1,
        width: h.width,
      };
    });
    expect(headingFlow.ordered).toBe(true);
    expect(headingFlow.aligned).toBe(true);
    expect(headingFlow.width).toBeGreaterThan(Math.min(600, width - 60));
    expect(issues.violations).toEqual([]);
    await page.screenshot({ path: path.join(out, `responsive-${width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator('#studio-guide').screenshot({ path: path.join(out, 'create-guide.png') });
  await page
    .locator('.studio-scenes')
    .screenshot({ path: path.join(out, 'real-compositions.png') });
  for (const [link, pane] of [
    ['text', 'text'],
    ['studio', 'studio'],
    ['elements', 'elements'],
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
