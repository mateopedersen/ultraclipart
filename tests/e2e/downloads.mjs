import { chromium, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const publication = JSON.parse(
  await fs.readFile(new URL('../../data/publication.json', import.meta.url), 'utf8'),
);
const engine = process.env.UC_BROWSER || 'chromium',
  upstream = process.env.BASE_URL || 'http://127.0.0.1:4331',
  origin = 'https://ultraclipart.com',
  cdn = process.env.CDN_BASE || 'verified per-file publication map';
const out = resolve(process.env.EVIDENCE_DIR || 'reports/downloads', engine);
await fs.mkdir(out, { recursive: true });
const browser = await { chromium, webkit }[engine].launch({
  headless: true,
  ...(engine === 'chromium' && process.env.CHROMIUM_BIN
    ? { executablePath: process.env.CHROMIUM_BIN }
    : {}),
});
const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
const report = {
  engine,
  upstream,
  origin,
  cdn,
  testedAt: new Date().toISOString(),
  checks: [],
  actualDownloads: [],
  csp: [],
  errors: [],
};
const downloads = [];
page.on('download', (file) => downloads.push(file));
page.on('pageerror', (error) => report.errors.push(error.message));
await page.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (event) =>
    window.__csp.push({ blocked: event.blockedURI, directive: event.effectiveDirective }),
  );
});
await page.route(`${origin}/**`, async (route) => {
  const url = new URL(route.request().url()),
    response = await route.fetch({ url: `${upstream}${url.pathname}${url.search}` });
  await route.fulfill({ response });
});
const fixture = 'https://assets.ultraclipart.com/download-qa/';
const status = page.locator('#download-status'),
  link = page.locator('[data-download-qa]');
const cors = { 'access-control-allow-origin': origin };
let pdf, webp;
const setLink = async (url) => {
  const kind = url.endsWith('.webp') ? 'webp' : 'pdf';
  const file = publication.files.find((file) => file.name === `winter-arctic-fox-resting.${kind}`);
  await link.evaluate(
    (element, value) => {
      element.href = value.url;
      element.dataset.expectedBytes = String(value.bytes);
      element.dataset.expectedSha256 = value.sha256;
      element.dataset.finalDownload = value.kind;
      element.download = `winter-arctic-fox-resting.${value.kind}`;
    },
    { url, bytes: file.bytes, sha256: file.sha256, kind },
  );
};
const saveClick = async (name) => {
  const event = page.waitForEvent('download', { timeout: 30000 });
  await link.click();
  const file = await event;
  await file.saveAs(resolve(out, name));
  return fs.readFile(resolve(out, name));
};
const failed = async (name) => {
  const before = downloads.length;
  await link.click();
  await expect(status).toContainText('could not finish');
  expect(downloads.length).toBe(before);
  await expect(link).not.toHaveAttribute('aria-busy', 'true');
  report.checks.push(name);
};
try {
  const response = await page.goto(`${origin}/art/winter-arctic-fox-resting/`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-security-policy']).toContain(
    "connect-src 'self' https://assets.ultraclipart.com",
  );
  await page.locator('.detail-actions a[data-download-format="pdf"]').click();
  await expect(page.locator('#download-dialog [data-final-download="pdf"]')).toBeVisible();
  expect(page.url()).toBe(`${origin}/art/winter-arctic-fox-resting/`);
  await page
    .locator('a[download][href$=".pdf"]')
    .first()
    .evaluate((element) => element.setAttribute('data-download-qa', ''));
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  for (const format of ['pdf', 'webp']) {
    const published = publication.files.find(
      (file) => file.name === `winter-arctic-fox-resting.${format}`,
    );
    const url = process.env.CDN_BASE ? `${cdn}/winter-arctic-fox-resting.${format}` : published.url,
      expected = await context.request.get(url, { headers: { Origin: origin } });
    expect(expected.status()).toBe(200);
    const source = await expected.body();
    if (format === 'pdf') pdf = source;
    else webp = source;
    await setLink(url);
    const bytes = await saveClick(`actual-cdn.${format}`);
    expect(bytes.equals(source)).toBe(true);
    if (!process.env.CDN_BASE)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(published.sha256);
    expect(
      format === 'pdf' ? bytes.subarray(0, 5).toString() : bytes.subarray(8, 12).toString(),
    ).toBe(format === 'pdf' ? '%PDF-' : 'WEBP');
    await expect(status).toHaveText('Your download is ready.');
    report.actualDownloads.push({
      url,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      cors: expected.headers()['access-control-allow-origin'],
    });
  }
  report.checks.push('real CDN PDF/WebP bytes and CORS match independent fetch');
  // Keep one request pending while clicking the same visible button twice.
  let release, start;
  let fetches = 0;
  const gate = new Promise((resolve) => (release = resolve)),
    started = new Promise((resolve) => (start = resolve));
  await page.route(`${fixture}double.pdf`, async (route) => {
    fetches++;
    start();
    await gate;
    await route.fulfill({ contentType: 'application/pdf', headers: cors, body: pdf });
  });
  await setLink(`${fixture}double.pdf`);
  const event = page.waitForEvent('download');
  await link.click();
  await started;
  await expect(link).toHaveAttribute('aria-busy', 'true');
  await expect(status).toHaveText('Preparing your download…');
  await link.click();
  expect(fetches).toBe(1);
  release();
  const double = await event;
  await double.saveAs(resolve(out, 'single-request.pdf'));
  await expect(link).not.toHaveAttribute('aria-busy', 'true');
  report.checks.push('double click creates one fetch and clears aria-busy');
  // A failed request leaves a keyboard-operable retry on the original link.
  let attempts = 0;
  await page.route(`${fixture}retry.pdf`, (route) =>
    route.fulfill(
      ++attempts === 1
        ? { status: 503, headers: cors, body: 'Unavailable' }
        : { contentType: 'application/pdf', headers: cors, body: pdf },
    ),
  );
  await setLink(`${fixture}retry.pdf`);
  await failed('HTTP failure exposes retry message');
  await link.focus();
  const retry = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  await (await retry).saveAs(resolve(out, 'keyboard-retry.pdf'));
  expect(attempts).toBe(2);
  await expect(status).toHaveText('Your download is ready.');
  report.checks.push('keyboard retry succeeds after failure');
  await page.route(`${fixture}html.pdf`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      headers: cors,
      body: '<!doctype html><h1>Error</h1>',
    }),
  );
  await setLink(`${fixture}html.pdf`);
  await failed('HTML content type is rejected');
  await page.route(`${fixture}declared-large.pdf`, (route) =>
    route.fulfill({
      contentType: 'application/pdf',
      headers: { ...cors, 'content-length': '16000001' },
      body: pdf,
    }),
  );
  await setLink(`${fixture}declared-large.pdf`);
  await failed('oversized declared content length is rejected');
  // Route transport delivers an oversize body without a useful declared length.
  await page.evaluate((url) => {
    window.__realFetch = window.fetch;
    window.__streamCancelled = false;
    window.fetch = (input, options) => {
      if (String(input) !== url) return window.__realFetch(input, options);
      let n = 0;
      const response = new Response(
        new ReadableStream({
          pull(controller) {
            if (n++ < 100) controller.enqueue(new Uint8Array(1000000).fill(65));
            else controller.close();
          },
          cancel() {
            window.__streamCancelled = true;
          },
        }),
        { headers: { 'content-type': 'application/pdf' } },
      );
      Object.defineProperty(response, 'url', { value: url });
      return Promise.resolve(response);
    };
  }, `${fixture}stream-large.pdf`);
  await setLink(`${fixture}stream-large.pdf`);
  await failed('actual streamed response bytes are bounded at 16 MB');
  expect(await page.evaluate(() => window.__streamCancelled)).toBe(true);
  await page.evaluate(() => (window.fetch = window.__realFetch));
  await page.route(`${fixture}empty.pdf`, (route) =>
    route.fulfill({ contentType: 'application/pdf', headers: cors, body: '' }),
  );
  await setLink(`${fixture}empty.pdf`);
  await failed('empty file rejected');
  // Valid bytes redirected to a non-CDN final origin must not be downloaded.
  await page.route(`${origin}/download-origin-fixture.pdf`, (route) =>
    route.fulfill({ contentType: 'application/pdf', body: pdf }),
  );
  if (engine === 'webkit') {
    // Playwright WebKit cannot fulfill a 302; model the fetch result's final URL.
    await page.evaluate(
      ({ url, finalUrl, bytes }) => {
        window.__realFetch = window.fetch;
        window.fetch = (input, options) => {
          if (String(input) !== url) return window.__realFetch(input, options);
          const response = new Response(new Uint8Array(bytes), {
            headers: { 'content-type': 'application/pdf' },
          });
          Object.defineProperty(response, 'url', { value: finalUrl });
          return Promise.resolve(response);
        };
      },
      {
        url: `${fixture}redirect.pdf`,
        finalUrl: `${origin}/download-origin-fixture.pdf`,
        bytes: [...pdf],
      },
    );
    report.originGateFixture = 'Synthetic final Response.url (WebKit route API cannot fulfill 302)';
  } else {
    await page.route(`${fixture}redirect.pdf`, (route) =>
      route.fulfill({
        status: 302,
        headers: { ...cors, location: `${origin}/download-origin-fixture.pdf` },
      }),
    );
    report.originGateFixture = 'HTTP 302 to same-site final response';
  }
  await setLink(`${fixture}redirect.pdf`);
  await failed('non-CDN final response origin rejected');
  if (engine === 'webkit') await page.evaluate(() => (window.fetch = window.__realFetch));
  await page.route(`${fixture}spoof.pdf`, (route) =>
    route.fulfill({
      contentType: 'application/pdf',
      headers: cors,
      body: '<!doctype html><h1>Not a PDF</h1>',
    }),
  );
  await setLink(`${fixture}spoof.pdf`);
  await failed('mislabelled PDF bytes rejected');
  await page.route(`${fixture}spoof.webp`, (route) =>
    route.fulfill({ contentType: 'image/webp', headers: cors, body: 'Not a WebP image' }),
  );
  await setLink(`${fixture}spoof.webp`);
  await failed('mislabelled WebP bytes rejected');
  await page.route(`${fixture}wrong-mime.pdf`, (route) =>
    route.fulfill({ contentType: 'image/webp', headers: cors, body: webp }),
  );
  await setLink(`${fixture}wrong-mime.pdf`);
  await failed('allowed but mismatched file type rejected');
  // Simulated time advances the real timeout without spending 30 wall-clock seconds.
  await page.clock.install();
  let unblock, timeoutStarted;
  const timeoutGate = new Promise((resolve) => (unblock = resolve)),
    timeoutSeen = new Promise((resolve) => (timeoutStarted = resolve));
  await page.route(`${fixture}timeout.pdf`, async (route) => {
    timeoutStarted();
    await timeoutGate;
    await route.abort().catch(() => {});
  });
  await setLink(`${fixture}timeout.pdf`);
  const before = downloads.length;
  await link.click();
  await timeoutSeen;
  await page.clock.runFor(30001);
  await expect(status).toContainText('could not finish');
  expect(downloads.length).toBe(before);
  unblock();
  await expect(link).not.toHaveAttribute('aria-busy', 'true');
  report.checks.push('30-second timeout aborts and clears pending state');
  report.csp = await page.evaluate(() => window.__csp);
  expect(report.csp).toEqual([]);
  expect(report.errors).toEqual([]);
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  report.accessibility = scan.violations.map(({ id, impact }) => ({ id, impact }));
  expect(report.accessibility).toEqual([]);
  report.status = 'PASS';
  await fs.writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = 'FAIL';
  report.failure = error.message;
  report.csp = await page.evaluate(() => window.__csp);
  await page.screenshot({ path: resolve(out, 'failure.png'), fullPage: true });
  await fs.writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  throw error;
} finally {
  await browser.close();
}
