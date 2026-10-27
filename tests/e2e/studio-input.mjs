import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chooseSelectionTool } from '../helpers/creator.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4351',
  out = resolve('reports/studio-input');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage(),
  id = 'classic-white-volleyball-realistic-clipart',
  errors = [],
  checks = [];
page.on('pageerror', (e) => errors.push(e.message));
const state = () =>
  page.evaluate((id) => JSON.parse(localStorage.getItem('ultraclipart:editor:v1:' + id)), id);
const settle = async () => {
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('data-processing', 'true', {
    timeout: 45000,
  });
};
try {
  await page.goto(`${base}/edit/${id}/`);
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true', {
    timeout: 45000,
  });
  await page.locator('button[data-work-mode=edit]').tap();
  await chooseSelectionTool(page, 'brush');
  await page.locator('.uc-canvas').scrollIntoViewIfNeeded();
  const point = await page.locator('[data-layer="original-image"]').evaluate((g) => {
    const p = new DOMPoint(691, 691).matrixTransform(g.getScreenCTM());
    return { x: p.x, y: p.y };
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  for (let i = 1; i <= 5; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x + i * 2, y: point.y + i }],
    });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle();
  assert.ok((await state()).selection.mask.data);
  await page.locator('[data-smart-action=apply]').focus();
  await page.keyboard.press('Enter');
  await settle();
  assert.equal((await state()).layers[0].regions.length, 1);
  checks.push('Native mobile touch brush and keyboard activation of Save region.');
  await page.locator('.uc-canvas').scrollIntoViewIfNeeded();
  const before = JSON.stringify(await state());
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: point.x + 10, y: point.y + 10 }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.equal(JSON.stringify(await state()), before);
  checks.push('Interrupted native touch leaves completed mask/history intact.');
  await page.locator('.uc-stage').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-status]')).toContainText('Selection ready', { timeout: 45000 });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: point.x - 25, y: point.y, id: 1 },
      { x: point.x + 25, y: point.y, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: point.x - 40, y: point.y, id: 1 },
      { x: point.x + 40, y: point.y, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  checks.push('Canvas keyboard selection and two-pointer pinch gesture executed.');
  await page.screenshot({ path: resolve(out, 'touch.png'), fullPage: true });
  // Worker-less fallback must still edit a real catalogue bitmap, without any server upload.
  const fallback = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
  await fallback.addInitScript(() => {
    window.Worker = undefined;
  });
  const cpu = await fallback.newPage();
  cpu.on('pageerror', (e) => errors.push(e.message));
  await cpu.goto(`${base}/edit/${id}/`);
  await expect(cpu.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true', {
    timeout: 45000,
  });
  await cpu.locator('button[data-work-mode=edit]').click();
  await cpu.locator('[data-advanced-selection]').evaluate((e) => (e.open = true));
  await cpu.locator('[data-point-x]').fill('691');
  await cpu.locator('[data-point-y]').fill('691');
  await cpu.locator('[data-smart-action=select-point]').click();
  await expect(cpu.locator('[data-status]')).toContainText('Selection ready', { timeout: 60000 });
  await cpu.locator('[data-smart-action=apply]').click();
  await expect(cpu.locator('.uc-editor')).not.toHaveAttribute('data-processing', 'true', {
    timeout: 60000,
  });
  const recovered = await cpu.evaluate(
    (id) => JSON.parse(localStorage.getItem('ultraclipart:editor:v1:' + id)),
    id,
  );
  assert.equal(recovered.layers[0].regions.length, 1);
  checks.push(
    'Worker unavailable: real 1382×1382 source selected and recolored by local CPU fallback.',
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    resolve(out, 'report.json'),
    JSON.stringify({ status: 'PASS', checks, errors }, null, 2),
  );
} finally {
  await browser.close();
}
