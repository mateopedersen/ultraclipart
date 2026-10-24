import { chromium, webkit, firefox, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const engine = process.env.UC_BROWSER || 'chromium';
const base = process.env.UC_BASE_URL || 'http://127.0.0.1:4353';
const out = `reports/sharing/${engine}`;
await fs.mkdir(out, { recursive: true });
const browser = await { chromium, webkit, firefox }[engine].launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  acceptDownloads: true,
});
await context.addInitScript(() => {
  const nativeSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (window.shareTest?.denyStorage && key === 'uc-public-shares-v1')
      throw new DOMException('Storage denied', 'QuotaExceededError');
    return nativeSetItem.call(this, key, value);
  };
  window.shareTest = { clipboard: [], native: [], clipboardDenied: false, nativeCancel: false };
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      async writeText(value) {
        if (window.shareTest.clipboardDenied) throw new DOMException('Denied', 'NotAllowedError');
        window.shareTest.clipboard.push(value);
      },
    },
  });
  Object.defineProperty(navigator, 'canShare', {
    configurable: true,
    value: (data) => !!data.files?.length,
  });
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: async (data) => {
      window.shareTest.native.push({
        title: data.title,
        text: data.text,
        url: data.url,
        files: await Promise.all(
          (data.files || []).map(async (file) => ({
            name: file.name,
            type: file.type,
            bytes: [...new Uint8Array(await file.arrayBuffer())],
          })),
        ),
      });
      if (window.shareTest.nativeCancel) throw new DOMException('Cancelled', 'AbortError');
    },
  });
  window.turnstile = {
    render(_target, options) {
      window.completeShareVerification = () => options.callback('test-verification-token');
      return 'test-widget';
    },
    remove() {},
  };
});
await context.route('**/@vite/client', (route) =>
  route.fulfill({
    contentType: 'text/javascript',
    body: 'export const createHotContext=()=>new Proxy({data:{}},{get:(o,k)=>k==="data"?o.data:()=>{}});const styles=new Map();export const updateStyle=(id,content)=>{let style=styles.get(id);if(!style){style=document.createElement("style");styles.set(id,style);document.head.append(style)}style.textContent=content};export const removeStyle=id=>{styles.get(id)?.remove();styles.delete(id)};',
  }),
);
const page = await context.newPage();
const errors = [],
  requests = [],
  checks = [],
  aiRequests = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => {
  if (request.url().includes('/api/ai/')) aiRequests.push(request.url());
  if (request.method() !== 'GET') requests.push({ method: request.method(), url: request.url() });
});
let sessionCalls = 0,
  createCalls = 0,
  deletes = 0,
  pendingPublish,
  delayPublish = false;
let id,
  secondId,
  token,
  loseResponse = false,
  deleteStatus = 200;
const credentials = new Map();
const publication = (value, key) => ({
  id: value,
  url: `https://ultraclipart.com/share/${value}/`,
  imageUrl: `https://ultraclipart.com/share/${value}/image.webp`,
  deleteToken: key,
});
await context.route('**/api/share/session', async (route) => {
  sessionCalls++;
  await route.fulfill({
    json: {
      enabled: true,
      remaining: 3,
      globalRemaining: 100,
      csrfToken: 'test-csrf',
      sitekey: 'test-sitekey',
    },
  });
});
await context.route('**/api/share/create', async (route) => {
  createCalls++;
  const request = route.request(),
    body = request.postDataJSON();
  assert.equal(request.headers()['x-csrf-token'], 'test-csrf');
  assert.deepEqual(Object.keys(body).sort(), [
    'deleteToken',
    'id',
    'imageData',
    'title',
    'turnstileToken',
  ]);
  assert.equal(body.turnstileToken, 'test-verification-token');
  assert.match(body.id, /^[a-f0-9]{32}$/);
  assert.match(body.deleteToken, /^[A-Za-z0-9_-]{43}$/);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('uc-public-shares-v1') || '[]'),
  );
  assert.ok(
    saved.some((record) => record.id === body.id && record.deleteToken === body.deleteToken),
    'Removal credentials saved before POST',
  );
  credentials.set(body.id, body.deleteToken);
  if (createCalls === 1) {
    id = body.id;
    token = body.deleteToken;
  } else secondId = body.id;
  const bytes = Buffer.from(body.imageData, 'base64');
  assert.ok(bytes.length <= 384 * 1024);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'webp');
  assert.ok(metadata.width <= 2048 && metadata.height <= 2048);
  await fs.writeFile(`${out}/published-${createCalls}.webp`, bytes);
  if (loseResponse) {
    await route.abort('failed');
    return;
  }
  if (delayPublish)
    pendingPublish = () =>
      route.fulfill({ status: 201, json: publication(body.id, body.deleteToken) });
  else await route.fulfill({ status: 201, json: publication(body.id, body.deleteToken) });
});
await context.route('**/api/share/*', async (route) => {
  if (!/\/api\/share\/[a-f0-9]{32}$/.test(route.request().url())) return route.fallback();
  assert.equal(route.request().method(), 'DELETE');
  const removeId = route.request().url().split('/').at(-1);
  assert.equal(route.request().headers().authorization, `Bearer ${credentials.get(removeId)}`);
  deletes++;
  await route.fulfill({ status: deleteStatus, json: { removed: deleteStatus === 200 } });
});
const dialog = page.locator('.uc-share');
async function goto(path) {
  if (page.url() !== 'about:blank') await page.waitForLoadState('networkidle');
  await page.goto(base + path);
}
async function catalogOpen(button) {
  const expected = await button.getAttribute('data-share-url');
  const title = await button.getAttribute('data-share-title');
  await button.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.uc-share-download')).toBeEnabled();
  await expect(dialog.locator('#uc-share-link')).toHaveValue(expected);
  await expect(dialog.locator('.uc-share-art-title')).toHaveText(title);
  assert.ok(!expected.includes('?'));
  return { expected, title };
}
async function close(trigger) {
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  if (trigger) await expect(trigger).toBeFocused();
}
async function saveDownload(button, filename) {
  const event = page.waitForEvent('download');
  await button.click();
  const downloaded = await event;
  await downloaded.saveAs(`${out}/${filename}`);
  return fs.readFile(`${out}/${filename}`);
}
try {
  await goto('/');
  const homeTrigger = page.locator('[data-share-art]').first();
  const home = await catalogOpen(homeTrigger);
  const firstId = home.expected.split('/').at(-2);
  await expect(dialog.locator('.uc-share-network')).toHaveCount(9);
  await expect
    .poll(() =>
      dialog
        .locator('img[src^="/social/"]')
        .evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)),
    )
    .toBe(true);
  const message = 'A&B + summer / café 🌸\nLine two: "creative"';
  await dialog.locator('#uc-share-caption').fill(message);
  const links = await dialog
    .locator('.uc-share-network')
    .evaluateAll((nodes) =>
      Object.fromEntries(
        nodes.map((node) => [node.getAttribute('aria-label').replace('Share on ', ''), node.href]),
      ),
    );
  assert.equal(new URL(links.Pinterest).searchParams.get('url'), home.expected);
  assert.equal(new URL(links.Pinterest).searchParams.get('description'), message);
  assert.equal(new URL(links.Facebook).searchParams.get('u'), home.expected);
  assert.equal(new URL(links.WhatsApp).searchParams.get('text'), message + '\n' + home.expected);
  assert.equal(new URL(links.X).searchParams.get('text'), message);
  assert.equal(new URL(links.Telegram).searchParams.get('text'), message);
  assert.equal(new URL(links.LinkedIn).searchParams.get('url'), home.expected);
  assert.equal(new URL(links.Reddit).searchParams.get('title'), message);
  assert.equal(new URL(links.Bluesky).searchParams.get('text'), message + '\n' + home.expected);
  assert.equal(new URL(links.Threads).searchParams.get('text'), message + '\n' + home.expected);
  assert.equal(
    new URL(await dialog.locator('.uc-share-email').getAttribute('href')).searchParams.get('body'),
    message + '\n' + home.expected,
  );
  checks.push(
    'Homepage catalog real preview, nine exact social intents, Unicode caption encoding, local logo assets',
  );
  await page.evaluate(() => (window.shareTest.clipboardDenied = true));
  await dialog.locator('.uc-share-copy-link').click();
  await expect(dialog.locator('.uc-share-status')).toContainText('Clipboard access is unavailable');
  await expect(dialog.locator('#uc-share-link')).toBeFocused();
  assert.deepEqual(
    await dialog
      .locator('#uc-share-link')
      .evaluate((input) => [input.selectionStart, input.selectionEnd]),
    [0, home.expected.length],
  );
  await page.evaluate(() => (window.shareTest.clipboardDenied = false));
  await dialog.locator('.uc-share-copy-link').click();
  await dialog.locator('.uc-share-copy-caption').click();
  assert.deepEqual(await page.evaluate(() => window.shareTest.clipboard), [
    home.expected,
    message + '\n' + home.expected,
  ]);
  await page.evaluate(() => (window.shareTest.nativeCancel = true));
  await dialog.locator('.uc-share-native').click();
  await expect(dialog.locator('.uc-share-status')).toContainText('Sharing cancelled');
  await page.evaluate(() => (window.shareTest.nativeCancel = false));
  await dialog.locator('.uc-share-native').click();
  await expect(dialog.locator('.uc-share-status')).toContainText('Image handed');
  const native = await page.evaluate(() => window.shareTest.native.at(-1));
  assert.equal(native.files[0].type, 'image/png');
  assert.equal((await sharp(Buffer.from(native.files[0].bytes)).metadata()).format, 'png');
  await dialog.locator('[data-share-app=instagram]').click();
  await expect(dialog.locator('.uc-share-app-help')).toContainText('Instagram');
  assert.equal(context.pages().length, 1);
  checks.push(
    'Clipboard denied manual selection/success, real PNG handed to native API mock, cancellation safe, no external post',
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    const overflow = await dialog.evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
      width: element.getBoundingClientRect().width,
      viewport: innerWidth,
    }));
    assert.ok(
      overflow.scroll <= overflow.client + 1,
      `dialog overflow ${width}: ${JSON.stringify(overflow)}`,
    );
    assert.ok(overflow.width <= width);
    const axe = await new AxeBuilder({ page })
      .include('.uc-share')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    await fs.writeFile(`${out}/axe-${width}.json`, JSON.stringify(axe.violations, null, 2));
    assert.deepEqual(axe.violations, [], `Accessibility at ${width}`);
    await dialog.screenshot({ path: `${out}/catalog-${width}.png` });
  }
  checks.push('320/390/768/1440 responsive dialog and Axe WCAG AA including contrast');
  await close(homeTrigger);
  await goto(`/art/${firstId}/?workspace=private-not-a-share-link`);
  const detailTrigger = page.locator('.share-trigger-detail');
  await catalogOpen(detailTrigger);
  await close(detailTrigger);
  await page.locator('[data-favorite]').click();
  await expect(page.locator('[data-favorite]')).toHaveAttribute('aria-pressed', 'true');
  await goto('/favorites/');
  const favoriteTrigger = page.locator('#favorites [data-share-art]').first();
  await catalogOpen(favoriteTrigger);
  await close(favoriteTrigger);
  await goto('/search/?q=volleyball');
  const searchTrigger = page.locator('#search-results [data-share-art]').first();
  await catalogOpen(searchTrigger);
  await close(searchTrigger);
  checks.push(
    'Detail, browser-saved favorites and dynamically rendered search cards use canonical artwork URL; Escape restores focus',
  );
  assert.equal(sessionCalls, 0);
  assert.equal(createCalls, 0);
  await goto('/create/?workspace=11111111-1111-4111-8111-111111111111');
  await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true');
  const doc = {
    version: 2,
    artId: 'my-clipart',
    width: 200,
    height: 200,
    background: 'transparent',
    layers: [
      {
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
      },
    ],
    crop: { x: 10, y: 20, width: 160, height: 140 },
    print: { paper: 'letter', orientation: 'portrait', margin: 0.5, scale: 'fit' },
  };
  await page.locator('[data-load]').setInputFiles({
    name: 'real-share.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  const studioTrigger = page.locator('[data-action=share]');
  await expect(studioTrigger).toBeEnabled();
  await studioTrigger.click();
  await expect(dialog.locator('.uc-share-download')).toBeEnabled();
  await expect(dialog.locator('.uc-share-link-area')).toBeHidden();
  await expect(dialog.locator('.uc-share-network')).toHaveCount(0);
  const bytes = await saveDownload(dialog.locator('.uc-share-download'), 'studio-transparent.png');
  const png = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(png.info.width, 160);
  assert.equal(png.info.height, 140);
  assert.deepEqual([...png.data.subarray(0, 4)], [0, 0, 0, 0]);
  assert.deepEqual(
    [...png.data.subarray((15 * 160 + 15) * 4, (15 * 160 + 15) * 4 + 4)],
    [255, 0, 0, 255],
  );
  await dialog.locator('.uc-share-publish summary').click();
  await expect(dialog.locator('.uc-share-publish-button')).toBeDisabled();
  await dialog.locator('#uc-share-title').fill('A red square & a fresh idea');
  assert.equal(sessionCalls, 0);
  await dialog.locator('.uc-share-consent input').check();
  assert.equal(sessionCalls, 0);
  await dialog.locator('.uc-share-publish-button').click();
  await page.waitForFunction(() => typeof window.completeShareVerification === 'function');
  assert.equal(sessionCalls, 1);
  assert.equal(createCalls, 0);
  await page.evaluate(() => window.completeShareVerification());
  await expect(dialog.locator('.uc-share-status')).toContainText('Public link created');
  assert.equal(createCalls, 1);
  await expect(dialog.locator('#uc-share-link')).toHaveValue(publication(id, token).url);
  await expect(dialog.locator('.uc-share-network')).toHaveCount(9);
  await dialog.locator('.uc-share-owned summary').click();
  const backup = await saveDownload(dialog.locator('.uc-share-backup'), 'removal-keys.json');
  assert.equal(JSON.parse(backup)[0].deleteToken, token);
  const remove = dialog.locator('.uc-share-owned-row button');
  await remove.click();
  assert.equal(deletes, 0);
  await expect(remove).toHaveText('Confirm removal');
  await remove.click();
  await expect(dialog.locator('.uc-share-status')).toContainText('Public link removed');
  assert.equal(deletes, 1);
  await expect(dialog.locator('.uc-share-consent input')).toBeEnabled();
  await expect(dialog.locator('.uc-share-consent input')).not.toBeChecked();
  await expect(dialog.locator('.uc-share-publish-button')).toBeDisabled();
  await expect(dialog.locator('.uc-share-restore')).toBeVisible();
  await dialog
    .locator('.uc-share-key-file')
    .setInputFiles({ name: 'keys.json', mimeType: 'application/json', buffer: backup });
  await expect(dialog.locator('.uc-share-status')).toContainText('key restored');
  assert.equal(deletes, 1);
  assert.equal(createCalls, 1);
  const ownedBefore = await page.evaluate(() => localStorage.getItem('uc-public-shares-v1'));
  for (const value of [
    { ...publication(id, token), title: 'x', url: 'https://evil.example/share/' + id + '/' },
    { ...publication(id, token), title: 'x', deleteToken: 'short' },
    null,
  ]) {
    await dialog.locator('.uc-share-key-file').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(value)),
    });
    await expect(dialog.locator('.uc-share-status')).toContainText('not a valid');
    assert.equal(
      await page.evaluate(() => localStorage.getItem('uc-public-shares-v1')),
      ownedBefore,
    );
  }
  checks.push(
    'Actual Studio crop/alpha PNG download, explicit consent and verification before only mock publish, bounded real WebP upload',
  );
  checks.push(
    'Created social link, two-click owned deletion, reset consent, real removal-key download/restore, malformed backups rejected without data loss',
  );
  delayPublish = true;
  await dialog.locator('.uc-share-consent input').check();
  await page.evaluate(() => {
    window.completeShareVerification = undefined;
  });
  await dialog.locator('.uc-share-publish-button').click();
  await page.waitForFunction(() => typeof window.completeShareVerification === 'function');
  await page.evaluate(() => {
    void window.completeShareVerification();
  });
  await expect.poll(() => createCalls).toBe(2);
  await close(studioTrigger);
  await pendingPublish();
  await expect
    .poll(() =>
      page.evaluate(
        (expectedId) =>
          JSON.parse(localStorage.getItem('uc-public-shares-v1') || '[]').some(
            (record) => record.id === expectedId,
          ),
        secondId,
      ),
    )
    .toBe(true);
  checks.push('Closing a dialog during an authorized publish still saves the returned removal key');
  delayPublish = false;
  loseResponse = true;
  await studioTrigger.click();
  await expect(dialog.locator('.uc-share-download')).toBeEnabled();
  await dialog.locator('.uc-share-publish summary').click();
  await dialog.locator('.uc-share-consent input').check();
  await page.evaluate(() => {
    window.completeShareVerification = undefined;
  });
  await dialog.locator('.uc-share-publish-button').click();
  await page.waitForFunction(() => typeof window.completeShareVerification === 'function');
  await page.evaluate(() => {
    void window.completeShareVerification();
  });
  await expect(dialog.locator('.uc-share-status')).toContainText('response was interrupted');
  assert.equal(createCalls, 3);
  const lostId = secondId;
  assert.ok(
    await page.evaluate(
      (value) =>
        JSON.parse(localStorage.getItem('uc-public-shares-v1')).some(
          (record) => record.id === value,
        ),
      lostId,
    ),
  );
  loseResponse = false;
  await page.evaluate(() => {
    window.completeShareVerification = undefined;
  });
  await dialog.locator('.uc-share-publish-button').click();
  await page.waitForFunction(() => typeof window.completeShareVerification === 'function');
  await page.evaluate(() => {
    void window.completeShareVerification();
  });
  await expect(dialog.locator('.uc-share-status')).toContainText('Public link created');
  assert.equal(createCalls, 4);
  assert.equal(secondId, lostId);
  assert.equal(
    await page.evaluate(
      (value) =>
        JSON.parse(localStorage.getItem('uc-public-shares-v1')).filter(
          (record) => record.id === value,
        ).length,
      lostId,
    ),
    1,
  );
  await dialog.locator('.uc-share-owned summary').click();
  deleteStatus = 404;
  const lostRow = dialog
    .locator('.uc-share-owned-row')
    .filter({ has: page.locator(`a[href="https://ultraclipart.com/share/${lostId}/"]`) });
  await lostRow.locator('button').click();
  await lostRow.locator('button').click();
  await expect(dialog.locator('.uc-share-status')).toContainText('already removed');
  assert.ok(
    await page.evaluate(
      (value) =>
        !JSON.parse(localStorage.getItem('uc-public-shares-v1')).some(
          (record) => record.id === value,
        ),
      lostId,
    ),
  );
  await page.evaluate(() => {
    window.shareTest.denyStorage = true;
  });
  const staleRow = dialog
    .locator('.uc-share-owned-row')
    .filter({ has: page.locator(`a[href="https://ultraclipart.com/share/${id}/"]`) });
  await staleRow.locator('button').click();
  await staleRow.locator('button').click();
  await expect(dialog.locator('.uc-share-status')).toContainText(
    'Public link removed. This browser could not clear',
  );
  await expect(staleRow).toHaveCount(0);
  await page.evaluate(() => {
    window.shareTest.denyStorage = false;
  });
  checks.push(
    'Lost POST response retains pre-saved removal credentials and retry reuses them without duplication; deletion 404 clears stale keys; local storage failure never misreports successful removal',
  );

  assert.deepEqual(errors, []);
  assert.deepEqual(aiRequests, []);
  assert.ok(requests.every((request) => request.url.startsWith(base + '/api/share/')));
  const report = {
    engine,
    checks,
    errors,
    sessionCalls,
    createCalls,
    deletes,
    externalPosts: 0,
    aiCalls: aiRequests.length,
    note: 'Real app rendering, PNG download/encoding and local storage; only external clipboard/native APIs, verification and public backend mocked. No external posts.',
  };
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ engine, passed: true, checks: checks.length }));
} finally {
  await browser.close();
}
