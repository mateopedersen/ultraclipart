import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = process.env.UC_BASE_URL || 'http://127.0.0.1:4334';
const out = path.resolve(process.env.UC_EVIDENCE_DIR || 'work/creator-touch');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.UC_BROWSER_PATH ? { executablePath: process.env.UC_BROWSER_PATH } : {}),
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const state = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('ultraclipart:editor:v1:my-clipart')));
try {
  await page.goto(`${base}/create/`);
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true');
  await page.locator('[data-shape=heart]').tap();
  expect((await state()).layers.length).toBe(1);
  await page.locator('[data-action=draw]').tap();
  const session = await context.newCDPSession(page);
  const draw = async (cancel) => {
    await page.locator('.uc-canvas').scrollIntoViewIfNeeded();
    const box = await page.locator('.uc-canvas>svg').boundingBox();
    const x = box.x + box.width * 0.2,
      y = box.y + box.height * 0.3;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 8; i++)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + box.width * 0.05 * i, y: y + Math.sin(i) * box.height * 0.08 }],
      });
    await session.send('Input.dispatchTouchEvent', {
      type: cancel ? 'touchCancel' : 'touchEnd',
      touchPoints: [],
    });
  };
  await draw(false);
  expect((await state()).layers.length).toBe(2);
  expect((await state()).layers.at(-1).markup).toContain(' C');
  const complete = await state();
  await draw(true);
  expect(await state()).toEqual(complete);
  await page.locator('[data-action=draw]').tap();
  await page.locator('[data-shape=star]').focus();
  await page.keyboard.press('Enter');
  expect((await state()).layers.length).toBe(3);
  await page.locator('[data-panel=transform]').tap();
  await page.locator('.uc-stage').focus();
  const prior = (await state()).layers.at(-1).x;
  await page.keyboard.press('ArrowRight');
  expect((await state()).layers.at(-1).x).toBe(prior + 1);
  expect(errors).toEqual([]);
  await page.screenshot({ path: path.join(out, 'touch-mobile.png'), fullPage: true });
  const report = {
    base,
    engine: 'Chromium',
    input: 'native CDP touch events in hasTouch mobile context',
    checks: [
      'shape insertion by touch',
      'native touch stroke completes editable cubic layer',
      'native touchCancel leaves completed document unchanged',
      'keyboard Enter inserts shape',
      'keyboard ArrowRight moves selected shape',
    ],
    errors,
  };
  await fs.writeFile(path.join(out, 'touch-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
