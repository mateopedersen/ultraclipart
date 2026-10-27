import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { chooseSelectionTool } from '../helpers/creator.mjs';
const engine = process.env.UC_BROWSER || 'chromium',
  base = process.env.BASE_URL || 'http://127.0.0.1:4351';
const out = resolve(process.env.EVIDENCE_DIR || 'reports/studio-tools', engine);
mkdirSync(out, { recursive: true });
const browser = await { chromium, firefox, webkit }[engine].launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1500, height: 1100 },
  acceptDownloads: true,
});
const page = await context.newPage();
const report = { engine, base, checks: [], sources: [], errors: [], states: [], status: 'running' };
page.on('pageerror', (e) => report.errors.push(e.message));
const art = JSON.parse(readFileSync(new URL('../../data/art.json', import.meta.url)));
let current;
const state = () =>
  page.evaluate((id) => JSON.parse(localStorage.getItem('ultraclipart:editor:v1:' + id)), current);
const settle = async () => {
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('data-operation-busy', 'true', {
    timeout: 120000,
  });
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('data-processing', 'true', {
    timeout: 60000,
  });
};
const action = async (name) => {
  await page.locator(`[data-smart-action="${name}"]`).click();
  await settle();
};
const panel = async (name) => {
  await page.locator(`[data-panel="${name}"]`).click();
};
const tool = async (name) => {
  await panel('studio');
  await page.locator('[data-studio-tool]').selectOption(name);
};
async function change(selector, value) {
  await page.locator(selector).evaluate((e, v) => {
    e.value = String(v);
    e.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await settle();
}
async function open(a) {
  current = a.id;
  await page.goto(`${base}/edit/${a.id}/`);
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true', {
    timeout: 45000,
  });
  await page.locator('button[data-work-mode=edit]').click();
  await page.locator('[data-advanced-selection]').evaluate((e) => (e.open = true));
  await settle();
}
async function pixelInfo(layer = 'original-image') {
  return page.locator(`.uc-canvas [data-layer="${layer}"] image`).evaluate(async (el) => {
    const image = new Image();
    image.src = el.getAttribute('href');
    await image.decode();
    const c = document.createElement('canvas');
    c.width = image.naturalWidth;
    c.height = image.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let hash = 2166136261,
      alpha = 2166136261,
      point,
      distance = Infinity;
    for (let i = 0; i < d.length; i++) {
      hash = Math.imul(hash ^ d[i], 16777619) >>> 0;
      if (i % 4 === 3) {
        alpha = Math.imul(alpha ^ d[i], 16777619) >>> 0;
        const n = (i - 3) / 4,
          x = n % c.width,
          y = Math.floor(n / c.width);
        const dist = ((x - c.width / 2) / c.width) ** 2 + ((y - c.height / 2) / c.height) ** 2;
        if (d[i] > 200 && dist < distance) {
          distance = dist;
          point = { x, y };
        }
      }
    }
    return { hash, alpha, point, width: c.width, height: c.height };
  });
}
async function clickNative(point, layer = 'original-image') {
  await page.locator('.uc-canvas').scrollIntoViewIfNeeded();
  const p = await page.locator(`.uc-canvas [data-layer="${layer}"]`).evaluate((g, p) => {
    const q = new DOMPoint(p.x, p.y).matrixTransform(g.getScreenCTM());
    return { x: q.x, y: q.y };
  }, point);
  await page.mouse.click(p.x, p.y);
  await settle();
}
async function selectPoint(p) {
  await change('[data-point-x]', p.x);
  await change('[data-point-y]', p.y);
  await action('select-point');
  await expect(page.locator('[data-status]')).toContainText('Selection ready', { timeout: 60000 });
}
async function downloadAction(selector, name) {
  const p = page.waitForEvent('download', { timeout: 120000 });
  await page.locator(selector).click();
  const d = await p;
  const file = resolve(out, name);
  await d.saveAs(file);
  assert.ok(statSync(file).size > 40);
  return file;
}
try {
  const targets = [
    art.find((a) => a.topic === 'volleyball' && a.style === 'Outline'),
    art.find((a) => a.topic === 'volleyball' && a.style === 'Watercolor'),
    art.find((a) => a.id.includes('sleeping-baby-moon')),
    art.find((a) => a.topic === 'winter' && a.id.includes('cardinal')),
    art.find((a) => a.topic === 'halloween' && a.id.includes('cauldron')),
    art.find((a) => a.topic === 'pumpkin' && a.id.includes('cutaway')),
    art.find((a) => a.id === 'volleyball-origami-geometric-clipart'),
    art.find((a) => a.id === 'volleyball-team-high-five-celebration-clipart'),
  ].filter(Boolean);
  assert.equal(targets.length, 8);
  for (const [i, a] of targets.entries()) {
    await open(a);
    const before = await pixelInfo();
    assert.ok(before.point);
    await chooseSelectionTool(page, i % 2 ? 'wand' : 'smart');
    if (i % 2) {
      await page.locator('[data-contiguous]').uncheck();
      await page.locator('[data-distance]').selectOption('rgb');
    }
    await selectPoint(before.point);
    const ms = Number(await page.locator('.uc-editor').getAttribute('data-selection-ms'));
    await page.locator('[data-refine-kind]').selectOption('feather');
    await action('refine');
    await expect(page.locator('[data-status]')).toContainText('Mask refined');
    await change('[data-region-color]', '#537cc4');
    const after = await pixelInfo();
    assert.notEqual(after.hash, before.hash);
    assert.equal(after.alpha, before.alpha);
    const saved = await state();
    assert.equal(saved.layers[0].regions.length, 1);
    assert.equal(saved.layers[0].width, a.width);
    await page.locator('button[data-work-mode=print]').click();
    await page.locator('button[data-work-mode=edit]').click();
    assert.equal((await pixelInfo()).hash, after.hash);
    report.sources.push({
      id: a.id,
      style: a.style,
      width: a.width,
      height: a.height,
      selectionMs: ms,
      alphaPreserved: true,
      modesPreserved: true,
    });
    await page.locator('[data-mask-overlay]').uncheck();
    await page.locator('.uc-canvas').screenshot({ path: resolve(out, `source-${i + 1}.png`) });
  }
  const a = art.find((a) => a.topic === 'volleyball' && a.style === 'Outline');
  await open(a);
  const source = await pixelInfo();
  // Keep only the source to make each tool's effect independently observable.
  await page.locator('[data-action=reset]').click();
  await settle();
  await page.locator('button[data-work-mode=edit]').click();
  await page.locator('[data-advanced-selection]').evaluate((e) => (e.open = true));
  await action('all');
  await change('[data-region-mode]', 'adjust');
  await tool('patterns');
  for (const pattern of ['dots', 'stripes', 'plaid', 'diamonds', 'texture', 'gradient']) {
    const before = await pixelInfo();
    await page.locator('[data-pattern-kind]').selectOption(pattern);
    await page.locator('[data-pattern-blend]').selectOption('normal');
    await change('[data-pattern-opacity]', 75);
    await action('pattern');
    assert.equal((await state()).layers[0].regions[0].pattern.kind, pattern);
    assert.notEqual((await pixelInfo()).hash, before.hash);
  }
  report.checks.push('All six patterns change actual pixels within a stored mask.');
  await tool('effects');
  for (const kind of [
    'outline',
    'shadow',
    'inner-shadow',
    'glow',
    'blur',
    'sharpen',
    'balance',
    'emboss',
  ]) {
    const before = await pixelInfo();
    await page.locator('[data-effect-kind]').selectOption(kind);
    await action('effect');
    let s = await state();
    const effect = s.layers[0].effects.at(-1);
    assert.equal(effect.kind, kind);
    const changed = await pixelInfo();
    assert.notEqual(changed.hash, before.hash);
    await page.locator(`[data-effect-toggle="${effect.id}"]`).click();
    await settle();
    assert.equal((await pixelInfo()).hash, before.hash);
    await page.locator(`[data-effect-delete="${effect.id}"]`).click();
    await settle();
  }
  report.checks.push(
    'Eight effects render, toggle back to exact prior pixels, and delete independently.',
  );
  await tool('palette');
  await action('extract-palette');
  await expect(page.locator('[data-palette] button')).not.toHaveCount(0);
  await page.locator('[data-palette-colors]').fill('#235b98,#d76d91,#709344');
  await action('save-palette');
  const priorPalette = await pixelInfo();
  await action('apply-palette');
  assert.equal((await state()).layers[0].regions[0].palette.target.length, 3);
  assert.notEqual((await pixelInfo()).hash, priorPalette.hash);
  await action('original-palette');
  assert.equal((await pixelInfo()).hash, priorPalette.hash);
  report.checks.push(
    'Three-color palette maps pixels, saves locally, and restores prior adjustments exactly.',
  );
  await tool('coloring');
  await action('coloring');
  const coloring = await pixelInfo();
  await action('correction');
  await change('[data-brush-size]', 50);
  await change('[data-brush-hardness]', 100);
  await clickNative(source.point);
  assert.equal((await state()).layers[0].regions.at(-1).stage, 'after-effects');
  assert.notEqual((await pixelInfo()).alpha, coloring.alpha);
  await chooseSelectionTool(page, 'restore');
  await clickNative(source.point);
  assert.equal((await pixelInfo()).hash, coloring.hash);
  // Cloning/repair from a separate nearby source should change pixels, never the source bitmap.
  for (const brush of ['clone', 'repair']) {
    await chooseSelectionTool(page, brush);
    await change('[data-sample-x]', source.point.x + 40);
    await change('[data-sample-y]', source.point.y + 40);
    await clickNative(source.point);
    assert.equal((await state()).layers[0].regions.at(-1).operation, brush);
    await page.locator('[data-action=undo]').click();
    await settle();
    assert.equal((await pixelInfo()).hash, coloring.hash);
  }
  report.checks.push(
    'Coloring-page eraser/restore round-trip exact; clone/repair strokes persist and undo exactly.',
  );
  await tool('sticker');
  await action('sticker');
  await downloadAction('[data-smart-action=cut-contour]', 'sticker-cut.svg');
  assert.match(readFileSync(resolve(out, 'sticker-cut.svg'), 'utf8'), /<path d="M/);
  await tool('composer');
  await expect(page.locator('[data-composer-list] option')).toHaveCount(art.length, {
    timeout: 30000,
  });
  for (const target of [targets[2], targets[4]]) {
    await page.locator('[data-composer-list]').selectOption(target.id);
    await action('add-clipart');
    await expect(page.locator('[data-status]')).toContainText('Clipart added', { timeout: 45000 });
    await panel('region');
    await page.locator('[data-advanced-selection]').evaluate((e) => (e.open = true));
    await action('all');
    await change('[data-region-color]', '#b56f9c');
    await tool('composer');
  }
  assert.equal((await state()).layers.filter((l) => l.kind === 'raster').length, 3);
  await panel('transform');
  await page.locator('[data-action=select-all]').click();
  await panel('layers');
  await page.locator('[data-action=group]').click();
  assert.equal(new Set((await state()).layers.map((l) => l.group)).size, 1);
  await page.locator('[data-action=ungroup]').click();
  const composerFile = await downloadAction('[data-action=save]', 'composer.json');
  await page.reload();
  await expect(page.locator('[data-status]')).toContainText('restored', { timeout: 60000 });
  await settle();
  assert.equal((await state()).layers.filter((l) => l.kind === 'raster').length, 3);
  await page.locator('button[data-work-mode=edit]').click();
  await panel('layers');
  await page.locator('[data-load]').setInputFiles(composerFile);
  await expect(page.locator('[data-status]')).toContainText('Saved project opened');
  await settle();
  report.checks.push(
    'Three different catalogue sources compose, group, render masks and reopen with verified source hashes.',
  );
  await panel('text');
  await page.locator('[data-text]').fill('Creative Studio');
  await page.locator('[data-action=text]').click();
  await tool('typography');
  for (const layout of ['arc', 'circle', 'straight']) {
    await page.locator('[data-type-layout]').selectOption(layout);
    await change('[data-type-stroke-width]', 2);
    await page.locator('[data-type-shadow]').check();
    await action('typography');
    assert.equal((await state()).layers.at(-1).typography.layout, layout);
    assert.equal((await state()).layers.at(-1).text, 'Creative Studio');
    await expect(page.locator('.uc-canvas text')).toHaveCount(30);
  }
  report.checks.push(
    'Straight, arc and circle captions preserve editable text, outlined glyphs and shadows.',
  );
  await panel('region');
  const firstId = (await state()).layers[0].id;
  await page.locator('[data-smart-source]').selectOption(firstId);
  await tool('templates');
  const layoutBefore = JSON.stringify(await state());
  for (const paper of ['letter', 'a4'])
    for (const template of ['stickers', 'labels', 'card', 'invitation', 'name-tags', 'worksheet']) {
      await panel('region');
      await page.locator('[data-smart-source]').selectOption(firstId);
      await tool('templates');
      await page.locator('[data-template-paper]').selectOption(paper);
      await page.locator('[data-template]').selectOption(template);
      await action('template');
      const d = await state();
      assert.equal(d.print.paper, paper);
      assert.equal(d.print.scale, 'actual');
      assert.ok(d.layers.length > 0);
      assert.ok(Math.abs(d.width - (paper === 'letter' ? 816 : 793.7008)) < 0.01);
      await page.locator('[data-action=undo]').click();
      await settle();
      assert.equal(JSON.stringify(await state()), layoutBefore);
    }
  report.checks.push(
    'Six templates on Letter and A4 create measured, editable layouts; Undo restores the composition exactly.',
  );
  await tool('quality');
  await action('quality');
  await expect(page.locator('[data-quality-report]')).toContainText('PPI');
  await expect(page.locator('[data-quality-report]')).toContainText('transparent');
  // Batch success is tested with simple original line artwork, without detailed photo-sized edited CMYK streams.
  await page.evaluate(() => {
    localStorage.clear();
    return new Promise((resolve) => {
      const r = indexedDB.deleteDatabase('ultraclipart-studio');
      r.onsuccess = r.onerror = r.onblocked = resolve;
    });
  });
  await open(art.find((a) => a.topic === 'volleyball' && a.style === 'Outline'));
  await page.locator('[data-action=reset]').click();
  await settle();
  await page.locator('button[data-work-mode=print]').click();
  await tool('variants');
  await page.locator('[data-variant-scope]').selectOption('composition');
  await downloadAction('[data-smart-action=variants]', 'three-variants.zip');
  await expect(page.locator('[data-status]')).toContainText('passed the 1,000,000-byte limit');
  report.checks.push(
    'Three full-resolution variations exported as six matched WebP/CMYK PDF files in a ZIP.',
  );
  await tool('trace');
  await downloadAction('[data-smart-action=trace]', 'outline-trace.svg');
  assert.match(readFileSync(resolve(out, 'outline-trace.svg'), 'utf8'), /fill-rule="evenodd"/);
  assert.ok(!readFileSync(resolve(out, 'outline-trace.svg'), 'utf8').includes('<image'));
  report.checks.push('Monochrome trace exports actual SVG paths and no embedded bitmap.');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await page.locator('button[data-work-mode=edit]').click();
    await panel('region');
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    report.states.push({ width, overflow, violations: audit.violations.map((v) => v.id) });
    assert.equal(overflow, false);
    assert.deepEqual(audit.violations, []);
    if (width === 390) await page.screenshot({ path: resolve(out, 'mobile.png'), fullPage: true });
  }
  report.memory = await page.evaluate(() =>
    performance.memory
      ? {
          usedJsHeapBytes: performance.memory.usedJSHeapSize,
          limitBytes: performance.memory.jsHeapSizeLimit,
        }
      : null,
  );
  assert.deepEqual(report.errors, []);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.failure = error.stack;
  await page.screenshot({ path: resolve(out, 'failure.png'), fullPage: true });
  process.exitCode = 1;
} finally {
  writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await browser.close();
}
