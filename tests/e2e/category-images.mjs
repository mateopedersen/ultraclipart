import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const engine = process.env.UC_BROWSER || 'chromium',
  base = process.env.BASE_URL || 'http://127.0.0.1:4323';
const browser = await { chromium, webkit }[engine].launch(),
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const images = new Set();
page.on('request', (request) => {
  if (request.resourceType() === 'image' && request.url().includes('/previews/'))
    images.add(request.url());
});
await page.route('**/previews/**', async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 180));
  await route.continue();
});
try {
  await page.goto(base + '/categories/');
  await expect(page.locator('#discovery-controls')).toHaveAttribute('data-ready', 'true');
  const choice = page
    .locator('label')
    .filter({ has: page.locator('[name=collection-filter][value=civic-voting]') });
  if (await page.locator('#cookie-notice [data-cookie-choice=necessary]').isVisible())
    await page.locator('#cookie-notice [data-cookie-choice=necessary]').click();
  await choice.hover();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-groups="civic-voting"] .subject-art img')].every(
      (img) => img.complete && img.naturalWidth > 0,
    ),
  );
  await choice.click();
  const ready = await page
    .locator('[data-topic]:not([hidden]) .subject-art img')
    .evaluateAll((imgs) => imgs.every((img) => img.complete && img.naturalWidth > 0));
  assert.equal(
    ready,
    true,
    'Anticipated filter images should be decoded without a blank wait after clicking',
  );
  assert.ok(images.size < 80, `Do not eagerly download all 238 subjects: ${images.size}`);
  writeFileSync(
    `reports/categories-refresh/images-${engine}.json`,
    JSON.stringify(
      {
        engine,
        artificialImageDelayMs: 180,
        readyImmediatelyAfterClick: ready,
        requestedPreviewImages: images.size,
        status: 'passed',
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
