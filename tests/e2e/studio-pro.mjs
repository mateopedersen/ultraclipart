import { chromium, firefox, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadTypescript } from '../helpers/typescript.mjs';
import { chooseExportFormat } from '../helpers/export.mjs';
import { chooseSelectionTool } from '../helpers/creator.mjs';
const { decodeMask } = await loadTypescript('src/editor/smart/pixels.ts');
const base = process.env.BASE_URL || 'http://127.0.0.1:4350',
  engine = process.env.UC_BROWSER || 'chromium',
  out = resolve(process.env.EVIDENCE_DIR || 'reports/studio-pro', engine);
mkdirSync(out, { recursive: true });
const browser = await { chromium, firefox, webkit }[engine].launch({ headless: true }),
  context = await browser.newContext({
    viewport: { width: 1500, height: 1100 },
    acceptDownloads: true,
  }),
  page = await context.newPage();
const report = { engine, base, checks: [], errors: [], exports: [] };
page.on('pageerror', (error) => report.errors.push(error.message));
const id = 'baby-girl-with-pink-bow-clipart';
const settle = async () => {
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('data-processing', 'true', {
    timeout: 45000,
  });
};
async function change(selector, value) {
  await page.locator(selector).evaluate((input, value) => {
    input.value = String(value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await settle();
}
async function action(name) {
  await page.locator(`[data-smart-action="${name}"]`).click();
  await settle();
}
async function point(x, y, mode = 'replace') {
  await page.locator('[data-mask-mode]').selectOption(mode);
  await page.locator('[data-point-x]').fill(String(x));
  await page.locator('[data-point-y]').fill(String(y));
  await action('select-point');
  await expect(page.locator('[data-status]')).not.toContainText('Finding');
}
async function saveProject(name) {
  const pending = page.waitForEvent('download');
  await page.locator('[data-action=save]').click();
  const download = await pending;
  const path = resolve(out, `${name}.json`);
  await download.saveAs(path);
  return JSON.parse(readFileSync(path));
}
async function polygon(points, mode = 'replace') {
  await page.locator('.uc-canvas').scrollIntoViewIfNeeded();
  await chooseSelectionTool(page, 'polygon');
  await page.locator('[data-mask-mode]').selectOption(mode);
  for (const [x, y] of points) {
    const pt = await page.locator('.uc-canvas [data-layer="original-image"]').evaluate(
      (g, p) => {
        const v = new DOMPoint(p[0], p[1]).matrixTransform(g.getScreenCTM());
        return { x: v.x, y: v.y };
      },
      [x, y],
    );
    await page.mouse.click(pt.x, pt.y);
  }
  await action('finish-polygon');
}
async function imageBytes(normalizeSource = false) {
  return await page
    .locator('.uc-canvas [data-layer="original-image"] image')
    .evaluate(async (image, normalizeSource) => {
      const loaded = new Image();
      loaded.src = image.getAttribute('href');
      await loaded.decode();
      if (normalizeSource) {
        // Match the editor's readback/putImageData/PNG pipeline without applying edits.
        // This isolates actual mask spill from browser premultiplied-alpha quantization.
        const source = document.createElement('canvas');
        source.width = loaded.naturalWidth;
        source.height = loaded.naturalHeight;
        const sourceContext = source.getContext('2d', { willReadFrequently: true });
        sourceContext.drawImage(loaded, 0, 0);
        const pixels = sourceContext.getImageData(0, 0, source.width, source.height);
        const output = document.createElement('canvas');
        output.width = source.width;
        output.height = source.height;
        output.getContext('2d').putImageData(pixels, 0, 0);
        loaded.src = output.toDataURL('image/png');
        await loaded.decode();
      }
      const canvas = document.createElement('canvas');
      canvas.width = loaded.naturalWidth;
      canvas.height = loaded.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(loaded, 0, 0);
      return Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    }, normalizeSource);
}
try {
  await page.goto(`${base}/edit/${id}/`);
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true', {
    timeout: 45000,
  });
  await page.locator('[data-work-mode=advanced]').click();
  await page.locator('[data-advanced-selection]').evaluate((e) => (e.open = true));
  await settle();
  await page.locator('.uc-canvas').screenshot({ path: resolve(out, 'baby-before.png') });
  const original = await imageBytes(true);
  await point(600, 100);
  await point(350, 250, 'add');
  await point(410, 425, 'add');
  // A few fold shadows remain disconnected: local polygon refinement is intentionally recorded.
  await polygon(
    [
      [452, 157],
      [477, 145],
      [515, 164],
      [540, 202],
      [505, 239],
      [475, 237],
      [450, 204],
    ],
    'add',
  );
  await page.locator('[data-region-name]').fill('Hair bow');
  await change('[data-region-color]', '#326acb');
  await page.locator('[data-mask-overlay]').uncheck();
  await settle();
  let project = await saveProject('baby-bow-project');
  assert.equal(project.layers[0].regions.length, 1);
  report.checks.push(
    'Hair bow: multi-click color selection plus manual polygon refinement; original face and dress retained.',
  );
  const bow = await imageBytes();
  const bowMask = decodeMask(project.layers[0].regions[0].mask);
  report.browserColorDelta = 0;
  for (const [x, y] of [
    [650, 400],
    [600, 500],
    [600, 800],
    [900, 1000],
  ]) {
    const p = (y * 1226 + x) * 4;
    assert.equal(bowMask[y * 1226 + x], 0, 'Unrelated face/dress point entered the mask');
    assert.equal(bow[p + 3], original[p + 3], 'Outside alpha changed');
    // Linux Firefox can differ by 2/255 after PNG premultiplication/readback.
    // Raw worker pixels remain subject to exact equality in the unit suite.
    for (let channel = 0; channel < 3; channel++) {
      const delta = Math.abs(bow[p + channel] - original[p + channel]);
      report.browserColorDelta = Math.max(report.browserColorDelta, delta);
      assert.ok(delta <= 2, `Outside RGB changed by ${delta} at ${x},${y}`);
    }
  }
  await action('new-region');
  // Separate garment pieces, avoiding neck, arms, hands and legs.
  await polygon(
    [
      [465, 623],
      [514, 655],
      [545, 700],
      [608, 728],
      [700, 736],
      [765, 714],
      [812, 644],
      [853, 671],
      [816, 779],
      [790, 869],
      [731, 898],
      [594, 874],
      [550, 840],
      [516, 757],
    ],
    'replace',
  );
  await polygon(
    [
      [557, 887],
      [633, 901],
      [728, 905],
      [778, 883],
      [766, 990],
      [713, 1076],
      [658, 1089],
      [613, 1018],
    ],
    'add',
  );
  await polygon(
    [
      [55, 961],
      [167, 874],
      [296, 845],
      [390, 878],
      [450, 940],
      [483, 1000],
      [489, 1045],
      [442, 1040],
      [388, 1009],
      [300, 983],
      [250, 981],
      [225, 1042],
      [179, 1107],
      [107, 1068],
    ],
    'add',
  );
  await polygon(
    [
      [963, 857],
      [1066, 897],
      [1160, 947],
      [1201, 993],
      [1137, 1057],
      [1061, 1081],
      [1025, 1042],
      [970, 1022],
      [951, 979],
    ],
    'add',
  );
  await page.locator('[data-region-name]').fill('Lavender dress');
  await page.locator('[data-region-mode]').selectOption('tint');
  await change('[data-region-color]', '#ad8bd4');
  await settle();
  project = await saveProject('baby-dress-project');
  assert.equal(project.layers[0].regions.length, 2);
  await action('new-region');
  await chooseSelectionTool(page, 'brush');
  await change('[data-brush-size]', '14');
  await page.locator('.uc-canvas').scrollIntoViewIfNeeded();
  const iris = await page.locator('.uc-canvas [data-layer="original-image"]').evaluate((g) => {
    const p = new DOMPoint(579, 466).matrixTransform(g.getScreenCTM());
    return { x: p.x, y: p.y };
  });
  await page.mouse.click(iris.x, iris.y);
  await expect(page.locator('[data-status]')).toContainText('Selection ready');
  await page.locator('[data-region-name]').fill('Iris detail');
  await page.locator('[data-region-mode]').selectOption('tint');
  await change('[data-region-color]', '#73644b');
  await settle();
  const final = await imageBytes();
  project = await saveProject('baby-edited-project');
  assert.equal(project.layers[0].regions.length, 3);
  await page.locator('[data-mask-overlay]').uncheck();
  await page.locator('.uc-canvas').screenshot({ path: resolve(out, 'baby-after.png') });
  await page.locator('.uc-editor').screenshot({ path: resolve(out, 'baby-editor-after.png') });
  await page.locator('[data-action=undo]').click();
  await settle();
  assert.equal((await saveProject('undo')).layers[0].regions.length, 3);
  await page.locator('[data-action=redo]').click();
  await settle();
  assert.deepEqual(await imageBytes(), final);
  report.checks.push('Undo/redo restores exact rendered pixels and three independent masks.');
  await page.waitForTimeout(350);
  await page.reload();
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true', {
    timeout: 45000,
  });
  await settle();
  assert.deepEqual(await imageBytes(), final);
  report.checks.push('Browser local recovery restores exact rendered pixels.');
  await page.locator('[data-work-mode=advanced]').click();
  await page.locator('[data-panel=layers]').click();
  await page.locator('[data-load]').setInputFiles(resolve(out, 'baby-edited-project.json'));
  await settle();
  assert.deepEqual(await imageBytes(), final);
  report.checks.push('Downloaded editable project reopens identically.');
  await page.locator('[data-panel=print]').click();
  await page.locator('[data-print=scale]').selectOption('native');
  await saveProject('baby-print-project');
  for (const format of ['webp', 'pdf']) {
    await page.locator('[data-action=export]').click();
    await chooseExportFormat(page, format);
    if (format === 'pdf') {
      await page.locator('[data-action=download]').click();
      await expect(page.locator('[data-export-status]')).toContainText(
        'above the 1,000,000-byte limit',
        { timeout: 90000 },
      );
      await page.locator('[data-allow-large-pdf]').check();
    }
    const pending = page.waitForEvent('download', { timeout: 90000 });
    await page.locator('[data-action=download]').click();
    const download = await pending;
    const path = resolve(out, `baby-edited.${format}`);
    await download.saveAs(path);
    report.exports.push({ format, path });
    await page.locator('[data-action=close-export]').click();
  }
  report.checks.push(
    'Edited WebP and lossless CMYK PDF downloaded. Large PDF option was explicitly selected for the detailed raster.',
  );
  await page.locator('[data-work-mode=print]').click();
  await page.locator('[data-studio-tool]').selectOption('sticker');
  await action('sticker');
  await expect(page.locator('[data-effects-list]')).toContainText('sticker');
  await settle();
  await page.locator('.uc-canvas').screenshot({ path: resolve(out, 'baby-sticker.png') });
  await page.locator('[data-studio-tool]').selectOption('coloring');
  await action('coloring');
  await settle();
  await page.locator('.uc-canvas').screenshot({ path: resolve(out, 'baby-coloring.png') });
  report.checks.push('Sticker silhouette and coloring-page effects rendered and saved.');
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.failure = error.stack;
  await page.screenshot({ path: resolve(out, 'failure.png'), fullPage: true });
  throw error;
} finally {
  writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
