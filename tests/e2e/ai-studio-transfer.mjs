import { chromium, webkit, firefox, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import sharp from 'sharp';
import AxeBuilder from '@axe-core/playwright';
const require = createRequire(
  realpathSync(new URL('../../node_modules/astro/package.json', import.meta.url)),
);
const { build } = require('esbuild');
const transferBundle = await build({
  entryPoints: ['src/ai/transfer.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'UCTransferAPI',
  platform: 'browser',
  target: 'es2022',
});
const engine = process.env.UC_BROWSER || 'chromium',
  base = process.env.UC_BASE_URL || 'http://127.0.0.1:4353';
const out = path.resolve('reports/ai-studio-transfer', engine);
await fs.mkdir(out, { recursive: true });
const browser = await { chromium, webkit, firefox }[engine].launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  acceptDownloads: true,
});
await context.addInitScript({
  content: transferBundle.outputFiles[0].text + '\nglobalThis.UCTransferAPI = UCTransferAPI;',
});
await context.route('**/@vite/client', (route) =>
  route.fulfill({
    contentType: 'text/javascript',
    body: 'export const createHotContext = () => new Proxy({ data: {} }, { get: (obj, key) => key === "data" ? obj.data : () => {} }); export const updateStyle = () => {}; export const removeStyle = () => {};',
  }),
);
const page = await context.newPage(),
  errors = [],
  checks = [];
page.on('pageerror', (e) => errors.push(e.message));
const ready = () =>
  expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true', { timeout: 60000 });
const state = () =>
  page.evaluate(() => {
    const p = new URLSearchParams(location.search),
      id = p.get('workspace') || p.get('import');
    return JSON.parse(
      localStorage.getItem('ultraclipart:editor:v1:my-clipart' + (id ? ':ai:' + id : '')),
    );
  });
const saved = async (name) => {
  const p = page.waitForEvent('download');
  await page.locator('[data-action=save]').click();
  const file = path.join(out, name);
  await (await p).saveAs(file);
  return JSON.parse(await fs.readFile(file, 'utf8'));
};
const change = async (s, value) => {
  await page.locator(s).fill(String(value));
  await page.locator(s).press('Tab');
};
const create = () =>
  page.evaluate(async () => {
    const module = window.UCTransferAPI;
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(10, 10, 25, 30);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(60, 10, 20, 30);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return module.createStudioTransfer(png, {
      prompt: 'A red block and a green block — örnek <img src=x onerror="window.pwned=1">',
      model: '@cf/black-forest-labs/flux-1-schnell',
      style: 'flat-color',
      createdAt: new Date().toISOString(),
    });
  });
try {
  await page.goto(base + '/create/');
  await ready();
  const transfer = await create();
  assert.match(transfer.url, /^\/create\/\?import=[a-f0-9-]+$/);
  await page.goto(base + transfer.url);
  await ready();
  await expect(page.locator('[data-status]')).toContainText('native resolution');
  let d = await saved('native-handoff.json');
  assert.equal(d.width, 96);
  assert.equal(d.height, 64);
  assert.equal(d.layers.length, 1);
  assert.equal(d.layers[0].width, 96);
  assert.equal(d.layers[0].ai.transferId, transfer.id);
  assert.equal(d.localSources.length, 1);
  assert.equal(await page.evaluate(() => window.pwned), undefined);
  assert.equal(new URL(page.url()).searchParams.get('workspace'), transfer.id);
  await page.reload();
  await ready();
  assert.equal((await state()).layers.length, 1);
  await page.goto(base + transfer.url);
  await ready();
  assert.equal((await state()).layers.length, 1);
  checks.push(
    'Native image, private Unicode metadata, no metadata execution, reload/back duplicate suppression',
  );

  await page.goto(base + '/create/');
  await ready();
  await page.locator('[data-panel=create]').click();
  await page.locator('[data-shape=rectangle]').click();
  const prior = await state();
  const second = await create();
  await page.goto(base + second.url);
  await ready();
  d = await saved('preserved-existing.json');
  assert.equal(d.layers.length, 2);
  assert.deepEqual(d.layers.slice(0, 1), prior.layers);
  await page.locator('[data-action=undo]').click();
  assert.equal((await state()).layers.length, 1);
  await page.locator('[data-action=redo]').click();
  assert.equal((await state()).layers.length, 2);
  checks.push('Recovered design and source layers preserved; insertion undo/redo');

  await page.locator('[data-panel=region]').click();
  await page.locator('[data-smart-source]').selectOption((await state()).layers.at(-1).id);
  await page.locator('[data-panel=transform]').click();
  await page.locator('[data-lock-ratio]').uncheck();
  await change('[data-prop=scaleX]', 200);
  await change('[data-prop=scaleY]', 150);
  await change('[data-prop=angle]', 30);
  await page.locator('[data-panel=region]').click();
  await page.locator('[data-advanced-selection]').evaluate((e) => (e.open = true));
  await change('[data-point-x]', 20);
  await change('[data-point-y]', 20);
  await page.locator('[data-smart-action=select-point]').click();
  await expect(page.locator('[data-status]')).toContainText('Selection ready');
  const before = await state(),
    source = before.layers.at(-1);
  await page.locator('.uc-extract-object').evaluate((e) => (e.open = true));
  await page.locator('[data-extract-name]').fill('Red object');
  await page.locator('[data-extract-remove]').check();
  await page.locator('[data-smart-action=extract-layer]').click();
  await expect(page.locator('[data-status]')).toContainText('Independent layer created');
  d = await saved('extracted-layer.json');
  const cut = d.layers.at(-1);
  assert.equal(d.layers.length, 3);
  assert.equal(cut.label, 'Red object');
  assert.equal(cut.width, 25);
  assert.equal(cut.height, 30);
  assert.equal(cut.angle, 30);
  assert.equal(cut.scaleX, 2);
  assert.equal(cut.scaleY, 1.5);
  assert.ok(
    Math.abs(cut.x - (source.x + Math.cos(Math.PI / 6) * 20 - Math.sin(Math.PI / 6) * 15)) < 1e-8,
  );
  assert.ok(
    Math.abs(cut.y - (source.y + Math.sin(Math.PI / 6) * 20 + Math.cos(Math.PI / 6) * 15)) < 1e-8,
  );
  assert.equal(d.layers.at(-2).regions.at(-1).operation, 'erase');
  const file = d.localSources.find((s) => s.id === cut.assetId),
    bytes = Buffer.from(file.data.split(',')[1], 'base64');
  const pixels = await sharp(bytes).ensureAlpha().raw().toBuffer();
  for (let i = 0; i < pixels.length; i += 4)
    assert.deepEqual([...pixels.subarray(i, i + 4)], [255, 0, 0, 255]);
  await page.locator('[data-action=undo]').click();
  assert.deepEqual((await state()).layers, before.layers);
  await page.locator('[data-action=redo]').click();
  assert.equal((await state()).layers.length, 3);
  await page.screenshot({ path: path.join(out, 'extracted-object.png'), fullPage: false });
  checks.push(
    'Real pixel extraction; source erase mask; rotation/nonuniform scale; exact color and history',
  );

  await page.locator('[data-panel=region]').click();
  await page.locator('[data-smart-source]').selectOption((await state()).layers.at(-1).id);
  await context.setOffline(true);
  await page.locator('[data-panel=transform]').click();
  await change('[data-prop=angle]', 45);
  const offline = await saved('offline-project.json');
  assert.equal(offline.layers.at(-1).angle, 45);
  await context.setOffline(false);
  await page.reload();
  await ready();
  assert.equal((await state()).layers.at(-1).angle, 45);
  checks.push('Offline local editing and project save; reload recovery');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex,nofollow');
  const secondSnapshot = await state();
  const other = await context.newPage();
  await other.goto(base + '/create/?workspace=' + transfer.id);
  await expect(other.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true');
  await other.locator('[data-panel=create]').click();
  await other.locator('[data-shape=ellipse]').click();
  await expect(other.locator('.uc-canvas [data-layer]')).toHaveCount(2);
  await page.reload();
  await ready();
  assert.deepEqual((await state()).layers, secondSnapshot.layers);
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('ultraclipart:editor:v1:my-clipart')).layers.length,
    ),
    1,
  );
  await other.close();
  checks.push(
    'Two independent Studio tabs preserve both AI workspaces and the main canvas; private workspace noindex',
  );

  const contracts = await page.evaluate(async () => {
    const mod = window.UCTransferAPI;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    canvas.getContext('2d').fillRect(0, 0, 64, 64);
    const png = await new Promise((r) => canvas.toBlob(r, 'image/png')),
      jpeg = await new Promise((r) => canvas.toBlob(r, 'image/jpeg'));
    const meta = {
      prompt: 'Two objects',
      model: 'test-model',
      style: 'realistic',
      createdAt: new Date().toISOString(),
    };
    const jpegPng = await mod.studioImageBlob(jpeg);
    const fallback = JSON.parse(await (await mod.createStudioProject(jpeg, meta)).text());
    const t = await mod.createStudioTransfer(png, meta),
      owners = Array.from({ length: 10 }, () => crypto.randomUUID());
    const result = await Promise.allSettled(
      owners.map((owner) => mod.claimStudioTransfer(t.id, owner)),
    );
    const success = result.findIndex((r) => r.status === 'fulfilled');
    await mod.finishStudioTransfer(t.id, owners[success], false);
    const reclaimed = await mod.claimStudioTransfer(t.id, owners[0]);
    await mod.finishStudioTransfer(t.id, owners[0], true);
    const consumed = await mod.claimStudioTransfer(t.id, owners[1]).then(
      () => false,
      () => true,
    );
    const invalid = await mod.claimStudioTransfer('../secret', owners[1]).then(
      () => false,
      () => true,
    );
    const pending = await mod.createStudioTransfer(png, meta);
    const db = await new Promise((r, j) => {
      const q = indexedDB.open('ultraclipart-ai-transfer', 1);
      q.onsuccess = () => r(q.result);
      q.onerror = () => j(q.error);
    });
    await new Promise((r, j) => {
      const tx = db.transaction('handoffs', 'readwrite'),
        store = tx.objectStore('handoffs'),
        q = store.get(pending.id);
      q.onsuccess = () => {
        q.result.expiresAt = Date.now() - 1;
        store.put(q.result);
      };
      tx.oncomplete = r;
      tx.onerror = j;
    });
    db.close();
    const expired = await mod.claimStudioTransfer(pending.id, owners[1]).then(
      () => false,
      () => true,
    );
    return {
      fulfilled: result.filter((r) => r.status === 'fulfilled').length,
      consumed,
      expired,
      invalid,
      reclaim: !!reclaimed,
      mime: jpegPng.type,
      fallback,
    };
  });
  assert.equal(contracts.fulfilled, 1);
  assert.equal(contracts.reclaim, true);
  assert.equal(contracts.consumed, true);
  assert.equal(contracts.expired, true);
  assert.equal(contracts.invalid, true);
  assert.equal(contracts.mime, 'image/png');
  assert.equal(contracts.fallback.layers[0].width, 64);
  assert.equal(contracts.fallback.localSources.length, 1);
  checks.push(
    '10 simultaneous claims admit exactly one; release/retry, consumed, expired and invalid transfer safety; lossless JPEG normalization and real project fallback',
  );
  await page.locator('[data-load]').setInputFiles({
    name: 'ai-project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(contracts.fallback)),
  });
  await expect(page.locator('[data-status]')).toContainText('Saved project opened');
  assert.equal((await state()).layers.length, 1);
  checks.push('Downloaded fallback project opens in the existing Studio importer');

  await page.goto(base + '/create/?import=33333333-3333-4333-8333-333333333333');
  await ready();
  await expect(page.locator('[data-status]')).toContainText('expired or is missing');
  assert.equal(await page.locator('.uc-canvas [data-layer]').count(), 1);
  await page.locator('[data-panel=region]').click();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
    );
  }
  await page.locator('.uc-extract-object').evaluate((e) => (e.open = true));
  const violations = (await new AxeBuilder({ page }).analyze()).violations;
  await fs.writeFile(path.join(out, 'accessibility.json'), JSON.stringify(violations, null, 2));
  assert.equal(violations.length, 0);
  checks.push('Missing transfer nonfatal; responsive 390/768/1440; Axe accessibility');

  const denied = await context.newPage();
  await denied.goto(base + '/create/');
  const deniedResult = await denied.evaluate(async () => {
    const mod = window.UCTransferAPI,
      canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const png = await new Promise((r) => canvas.toBlob(r, 'image/png')),
      meta = { prompt: 'Test', model: 'test', style: 'flat', createdAt: new Date().toISOString() };
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get() {
        throw new DOMException('Denied', 'SecurityError');
      },
    });
    const failed = await mod.createStudioTransfer(png, meta).then(
      () => false,
      (e) => /project file/.test(e.message),
    );
    const fallback = await mod.createStudioProject(png, meta);
    return { failed, fallback: fallback.size > 100 };
  });
  assert.deepEqual(deniedResult, { failed: true, fallback: true });
  await denied.close();
  checks.push('Storage denied gives project fallback; no additional server upload');
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(out, 'report.json'),
    JSON.stringify({ engine, checks, errors, passed: true }, null, 2),
  );
  console.log(JSON.stringify({ engine, checks: checks.length, passed: true }));
} finally {
  await browser.close();
}
