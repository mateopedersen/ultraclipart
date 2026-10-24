import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import fs from 'node:fs/promises';
const engine = process.env.UC_BROWSER || 'chromium',
  base = process.env.UC_BASE_URL || 'http://127.0.0.1:4353';
const out = `reports/creation-share/${engine}`;
await fs.mkdir(out, { recursive: true });
const browser = await { chromium, webkit }[engine].launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(),
  errors = [],
  posts = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('request', (r) => {
  if (r.method() === 'POST') posts.push(r.url());
});
await page.route('**/@vite/client', (r) =>
  r.fulfill({
    contentType: 'text/javascript',
    body: 'export const createHotContext=()=>new Proxy({data:{}},{get:(o,k)=>k==="data"?o.data:()=>{}});export const updateStyle=()=>{};export const removeStyle=()=>{};',
  }),
);
// Contract double captures the real rendered image; the shared dialog and publishing backend have separate tests.
await page.route('**/src/share/client.ts*', (r) =>
  r.fulfill({
    contentType: 'text/javascript',
    body: 'export async function openShare(input){window.shareCalls??=[];window.shareCalls.push({kind:input.kind,title:input.title,sourceUrl:input.sourceUrl,type:input.blob.type,bytes:[...new Uint8Array(await input.blob.arrayBuffer())]});await new Promise(resolve=>window.releaseShare=resolve);}',
  }),
);
await page.route('**/api/ai/clipart/quota', (r) =>
  r.fulfill({
    json: {
      enabled: false,
      remaining: 0,
      globalRemaining: 0,
      resetAt: new Date(Date.now() + 86400000).toISOString(),
      sitekey: '',
      model: 'test-fixture',
    },
  }),
);
try {
  await page.goto(base + '/create/?workspace=11111111-1111-4111-8111-111111111111');
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('[data-action=share]')).toBeDisabled();
  const layer = {
    id: 'red',
    kind: 'vector',
    label: 'Red square',
    visible: true,
    locked: false,
    opacity: 1,
    x: 20,
    y: 30,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    markup: '<rect width="100" height="80" fill="#ff0000"/>',
  };
  const doc = {
    version: 2,
    artId: 'my-clipart',
    width: 200,
    height: 200,
    background: 'transparent',
    layers: [layer],
    crop: { x: 10, y: 20, width: 160, height: 140 },
    print: { paper: 'letter', orientation: 'portrait', margin: 0.5, scale: 'fit' },
  };
  await page.locator('[data-load]').setInputFiles({
    name: 'share-test.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  await expect(page.locator('[data-action=share]')).toBeEnabled();
  const before = await page.evaluate(() =>
    localStorage.getItem(
      'ultraclipart:editor:v1:my-clipart:ai:11111111-1111-4111-8111-111111111111',
    ),
  );
  await page.locator('[data-action=share]').click();
  await page.waitForFunction(() => window.shareCalls?.length === 1);
  await expect(page.locator('[data-action=share]')).toBeDisabled();
  const studio = await page.evaluate(() => window.shareCalls[0]);
  assert.equal(studio.kind, 'creation');
  assert.equal(studio.type, 'image/png');
  assert.equal(studio.sourceUrl, 'https://ultraclipart.com/create/');
  const result = await sharp(Buffer.from(studio.bytes))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(result.info.width, 160);
  assert.equal(result.info.height, 140);
  assert.deepEqual([...result.data.subarray(0, 4)], [0, 0, 0, 0]);
  assert.deepEqual(
    [...result.data.subarray((15 * 160 + 15) * 4, (15 * 160 + 15) * 4 + 4)],
    [255, 0, 0, 255],
  );
  await fs.writeFile(`${out}/studio-shared.png`, Buffer.from(studio.bytes));
  await page.evaluate(() => window.releaseShare());
  await expect(page.locator('[data-action=share]')).toBeEnabled();
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem(
        'ultraclipart:editor:v1:my-clipart:ai:11111111-1111-4111-8111-111111111111',
      ),
    ),
    before,
  );
  await page.locator('[data-action=export]').click();
  await expect(page.locator('[data-export-dialog]')).toBeVisible();
  await page.locator('[data-action=close-export]').click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('.uc-command').screenshot({ path: `${out}/studio-actions-${width}.png` });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

  // Let newly revealed lazy images finish before navigation; WebKit otherwise reports cancelled requests as access errors.
  await page.waitForLoadState('networkidle');
  await page.goto(base + '/ai-clipart-generator/');
  await expect(page.locator('[data-ai-action=share]')).toBeDisabled();
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 48;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(2, 4, 20, 20);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(30, 4, 20, 20);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png')),
      bytes = await blob.arrayBuffer();
    const db = await new Promise((r, j) => {
      const q = indexedDB.open('ultraclipart-ai-history', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('images', { keyPath: 'id' });
      q.onsuccess = () => r(q.result);
      q.onerror = () => j(q.error);
    });
    await new Promise((r, j) => {
      const tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').put({
        id: 'share-test-fixture',
        prompt: 'A private prompt that must not be shared',
        composedPrompt: 'private composed prompt',
        style: 'flat-color',
        model: 'test-fixture',
        createdAt: new Date().toISOString(),
        width: 64,
        height: 48,
        original: bytes,
        originalType: 'image/png',
      });
      tx.oncomplete = r;
      tx.onerror = j;
    });
    db.close();
  });
  await page.reload();
  await page.locator('.ai-history-section > summary').click();
  await page.locator('#ai-history button').first().click();
  await expect(page.locator('[data-ai-action=share]')).toBeEnabled();
  await page.locator('#ai-refine-tools').evaluate((e) => (e.open = true));
  await page.locator('[data-ai-action=rotate]').click();
  await expect(page.locator('[data-ai-action=share]')).toBeEnabled();
  const current = await page.locator('#ai-canvas').evaluate((c) => ({
    width: c.width,
    height: c.height,
    rgba: [...c.getContext('2d').getImageData(0, 0, c.width, c.height).data],
  }));
  assert.equal(current.width, 48);
  assert.equal(current.height, 64);
  await page.locator('[data-ai-action=share]').click();
  await page.waitForFunction(() => window.shareCalls?.length === 1);
  await expect(page.locator('[data-ai-action=share]')).toBeDisabled();
  const ai = await page.evaluate(() => window.shareCalls[0]);
  assert.equal(ai.title, 'My AI clipart');
  assert.equal(ai.sourceUrl, 'https://ultraclipart.com/ai-clipart-generator/');
  const aiPixels = await sharp(Buffer.from(ai.bytes)).ensureAlpha().raw().toBuffer();
  assert.deepEqual([...aiPixels], current.rgba);
  await fs.writeFile(`${out}/ai-current-shared.png`, Buffer.from(ai.bytes));
  await page.evaluate(() => window.releaseShare());
  await expect(page.locator('[data-ai-action=share]')).toBeEnabled();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('.ai-board-actions').screenshot({ path: `${out}/ai-actions-${width}.png` });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  page.once('dialog', (d) => d.accept());
  await page.locator('[data-ai-action=clear]').click();
  await expect(page.locator('[data-ai-action=share]')).toBeDisabled();
  assert.deepEqual(posts, []);
  assert.deepEqual(errors, []);
  const report = {
    engine,
    passed: true,
    checks: [
      'Empty Studio and AI result disable sharing',
      'Actual Studio crop and alpha PNG pixels',
      'Actual locally edited AI canvas matches every PNG pixel',
      'Busy share guard',
      'No prompt or private workspace in share metadata',
      'Editable project and export dialog preserved',
      'Clear AI data disables sharing',
      'Zero POST requests and zero AI generation calls',
      'Desktop and mobile action layout without page overflow',
    ],
    errors,
    posts,
  };
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ engine, passed: true, checks: report.checks.length }));
} finally {
  await browser.close();
}
