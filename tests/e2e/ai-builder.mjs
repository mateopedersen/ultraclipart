import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { chromium, firefox, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const name = process.env.BROWSER || 'chromium';
const base = process.env.BASE_URL || 'http://127.0.0.1:4353';
const output = `reports/ai-builder/${name}`;
await fs.mkdir(output, { recursive: true });
const engine = { chromium, firefox, webkit }[name];
const browser = await engine.launch({ headless: true });
const browserContext = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await browserContext.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const report = {
  browser: name,
  kind: 'UI contract tests with recorded real model output; not new inference',
  checks: [],
  responsive: [],
};
try {
  const image = (
    await sharp('public/ai-examples/baby-rabbit-640.webp')
      .resize(1024, 1024)
      .jpeg({ quality: 95 })
      .toBuffer()
  ).toString('base64');
  await page.route('**/api/ai/clipart/quota', (route) =>
    route.fulfill({
      json: {
        enabled: true,
        remaining: 2,
        globalRemaining: 24,
        resetAt: '2026-10-25T00:00:00Z',
        sitekey: 'test-fixture',
        model: '@cf/black-forest-labs/flux-1-schnell',
      },
    }),
  );
  await page.route(
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: 'window.turnstile={render:(target,opts)=>{window.fixtureCallback=opts.callback;opts.callback("fixture-token");return "fixture-widget"},reset:()=>window.fixtureCallback("fixture-token")};',
      }),
  );
  let calls = 0;
  let lastBody;
  let responseStatus = 200;
  await page.route('**/api/ai/clipart/generate', async (route) => {
    calls++;
    lastBody = route.request().postDataJSON();
    if (responseStatus !== 200)
      return route.fulfill({ status: responseStatus, json: { error: 'Test capacity message' } });
    return route.fulfill({
      json: {
        image,
        model: '@cf/black-forest-labs/flux-1-schnell',
        width: 1024,
        height: 1024,
        createdAt: new Date().toISOString(),
        neurons: 172.8,
        prompt: lastBody.prompt,
        composedPrompt: lastBody.prompt + ' illustration preferences',
        style: lastBody.style,
      },
    });
  });
  await page.goto(base + '/');
  await page.screenshot({ path: `${output}/homepage.png`, fullPage: false });
  await page.locator('#home-ai-prompt').fill('A small rabbit with a yellow daisy — 黄色, Türkçe');
  await page.locator('#home-ai-form button').click();
  await page.waitForURL('**/ai-clipart-generator/');
  assert.equal(
    await page.locator('#ai-prompt').inputValue(),
    'A small rabbit with a yellow daisy — 黄色, Türkçe',
  );
  assert.equal(calls, 0);
  report.checks.push(
    'Homepage exact Unicode transfer; no automatic inference; catalog search retained',
  );
  assert.equal(
    await page.locator('link[rel=canonical]').getAttribute('href'),
    'https://ultraclipart.com/ai-clipart-generator/',
  );
  assert.equal(await page.locator('main h1').count(), 1);
  assert.equal(await page.locator('.ai-faq details').count(), 7);
  await page.screenshot({ path: `${output}/builder-empty.png`, fullPage: true });
  await page.locator('#ai-generate').click();
  await page.locator('#ai-canvas').waitFor({ state: 'visible' });
  await page.locator('#ai-status').filter({ hasText: 'ready' }).waitFor();
  assert.equal(calls, 1);
  assert.equal(lastBody.style, 'realistic');
  assert.equal(lastBody.turnstileToken, 'fixture-token');
  report.checks.push(
    'Generate contract: original prompt, supported style/options, single request, native1024',
  );
  const pixels = () =>
    page.locator('#ai-canvas').evaluate((canvas) => {
      const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] < 255) transparent++;
      return { transparent, w: canvas.width, h: canvas.height, first: [...d.slice(0, 4)] };
    });
  const before = await pixels();
  assert.equal(before.transparent, 0);
  await page.getByText('Background, size & print quality', { exact: true }).click();
  await page.locator('[data-ai-action=cutout]').click();
  await page.locator('#ai-status').filter({ hasText: 'Light background removed' }).waitFor();
  const after = await pixels();
  assert.ok(after.transparent > 0);
  assert.equal(calls, 1);
  report.checks.push('Actual alpha from worker background removal; no inference for edits');
  await page.locator('[data-ai-action=compare]').click();
  assert.ok(await page.locator('#ai-before').isVisible());
  await page.locator('[data-ai-action=compare]').click();
  await page.locator('[data-ai-action=undo]').click();
  assert.equal((await pixels()).transparent, 0);
  await page.locator('[data-ai-action=redo]').click();
  assert.equal((await pixels()).transparent, after.transparent);
  report.checks.push('Compare original / undo / redo preserve pixel alpha');
  await page.locator('[data-ai-action=flip]').click();
  await page.locator('[data-ai-action=rotate]').click();
  await page.locator('[data-ai-action=trim]').click();
  await page.locator('[data-ai-action=bw]').click();
  await page.locator('#ai-resize').fill('512');
  await page.locator('[data-ai-action=resize]').click();
  await page.waitForFunction(() => document.querySelector('#ai-canvas').width === 512);
  report.checks.push('Flip, rotate, trim, grayscale and resize render real pixels');
  const filePromise = page.waitForEvent('download');
  await page.locator('[data-ai-action=download]').click();
  const file = await filePromise;
  await file.saveAs(`${output}/clipart.webp`);
  const webp = await fs.readFile(`${output}/clipart.webp`);
  assert.equal(webp.subarray(0, 4).toString(), 'RIFF');
  const projectPromise = page.waitForEvent('download');
  await page.locator('[data-ai-action=project]').click();
  await (await projectPromise).saveAs(`${output}/project.json`);
  const project = JSON.parse(await fs.readFile(`${output}/project.json`, 'utf8'));
  assert.ok(project.layers.length);
  report.checks.push('Actual WebP and valid editable project downloads');
  await page.reload();
  await page.locator('.ai-history-section > summary').click();
  await page.locator('#ai-history button').waitFor();
  await page.locator('#ai-history button').first().click();
  await page.locator('#ai-canvas').waitFor({ state: 'visible' });
  assert.equal((await pixels()).w, 512);
  report.checks.push('IndexedDB reload restores latest edited dimensions');
  await page.context().setOffline(true);
  await page.locator('[data-ai-action=flip]').click();
  await page.waitForFunction(() => !document.querySelector('[data-ai-action=download]').disabled);
  await page.context().setOffline(false);
  report.checks.push('Local edit and download work offline');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('#ai-prompt-title').scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    assert.equal(overflow, false, `overflow at ${width}`);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();
    assert.equal(
      axe.violations.length,
      0,
      JSON.stringify(
        axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ),
    );
    report.responsive.push({ width, overflow, axeWithoutContrast: axe.violations.length });
    await page.screenshot({ path: `${output}/builder-${width}.png`, fullPage: width === 1440 });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fullAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  report.contrast = fullAxe.violations.map((v) => ({
    id: v.id,
    nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
  }));
  assert.equal(fullAxe.violations.length, 0, JSON.stringify(report.contrast));
  responseStatus = 429;
  await page.locator('#ai-generate').click();
  await page.locator('#ai-status').filter({ hasText: 'Test capacity message' }).waitFor();
  assert.equal(calls, 2);
  assert.ok(await page.locator('#ai-canvas').isVisible());
  report.checks.push('429 has honest error, retains old image, no retry');
  assert.deepEqual(errors, []);
  report.errors = errors;
  await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
