import { chromium, firefox, webkit, expect } from '@playwright/test';
import { chooseVectorStarter } from '../helpers/creator.mjs';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:4321';
const engine = process.env.UC_BROWSER ?? 'chromium';
const browser = await { chromium, firefox, webkit }[engine].launch({ headless: true });
try {
  for (const width of [320, 390, 768]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.goto(`${base}/create/?view=page`, { waitUntil: 'domcontentloaded' });
    const editor = page.locator('.uc-editor');
    const properties = editor.locator('.uc-properties');
    await editor.locator('[data-panel="text"]').click();
    await expect(properties).toBeVisible();
    await expect(editor).toHaveAttribute('data-active-panel', 'text');
    await expect(properties.locator('[data-inspector-panel]')).toHaveValue('text');
    await chooseVectorStarter(page, 'botanical-sprig');
    await expect(editor.locator('.uc-canvas [data-layer]').first()).toBeVisible();
    await editor.locator('[data-wb-back-page]').click();
    await expect(editor).toHaveAttribute('data-wb-focus', 'true');
    await editor.locator('[data-panel="text"]').click();
    await expect(properties.locator('[data-action="text"]')).toBeVisible();
    await editor.locator('[data-wb-back-page]').click();
    await expect(editor).toHaveAttribute('data-wb-focus', 'false');
    await page.close();
    console.log(`Mobile editor and starter controls work at ${width}px`);
  }
} finally {
  await browser.close();
}
