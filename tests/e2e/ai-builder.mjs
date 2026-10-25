import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { chromium, firefox, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { examples, featuredIngredientIds } from '../../src/ai/ideas.ts';
const name = process.env.BROWSER || 'chromium';
const base = process.env.BASE_URL || 'http://127.0.0.1:4353';
const output = `${process.env.EVIDENCE_DIR || 'reports/ai-builder'}/${name}`;
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
  kind: 'UI contract tests using a resized recorded-model fixture; no new inference or model-quality claim',
  status: 'running',
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
  await page.route(/\/api\/ai\/clipart\/quota\/?$/, (route) =>
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
  await page.route(/\/api\/ai\/clipart\/generate\/?$/, async (route) => {
    calls++;
    lastBody = route.request().postDataJSON();
    if (responseStatus !== 200)
      return route.fulfill({ status: responseStatus, json: { error: 'capacity_or_rate_limit' } });
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
  assert.equal(await page.locator('#home-ai-form').count(), 0);
  await page.locator('.site-header a[href="/ai-clipart-generator/"]').click();
  await page.waitForURL('**/ai-clipart-generator/');
  await page.locator('#ai-prompt').fill('A small rabbit with a yellow daisy — 黄色, Türkçe');
  assert.equal(
    await page.locator('#ai-prompt').inputValue(),
    'A small rabbit with a yellow daisy — 黄色, Türkçe',
  );
  assert.equal(calls, 0);
  report.checks.push('Header Builder entry, exact Unicode draft and no automatic inference');
  assert.equal(
    await page.locator('link[rel=canonical]').getAttribute('href'),
    'https://ultraclipart.com/ai-clipart-generator/',
  );
  assert.equal(await page.locator('main h1').count(), 1);
  assert.equal(await page.locator('.ai-faq details').count(), 7);
  await page.screenshot({ path: `${output}/builder-empty.png`, fullPage: true });
  const originalDescription = await page.locator('#ai-prompt').inputValue();
  await page.locator('#ai-empty [data-ai-example="reading"]').click();
  assert.equal(
    await page.locator('#ai-prompt').inputValue(),
    examples.find((x) => x.id === 'reading').prompt,
  );
  assert.equal(calls, 0);
  await page.locator('[data-ai-style="cut-paper"]').click();
  assert.equal(await page.locator('#ai-style').inputValue(), 'cut-paper');
  await page.locator('[data-ai-show-styles]').click();
  assert.equal(await page.locator('#ai-choice-dialog [data-ai-choice-value]').count(), 20);
  await page.locator('#ai-choice-dialog [data-ai-choice-value="clay-3d"]').click();
  assert.equal(await page.locator('#ai-style').inputValue(), 'clay-3d');
  await page.locator('[data-ai-show-styles]').click();
  await page.locator('#ai-choice-dialog [data-ai-choice-value="realistic"]').click();
  assert.equal(await page.locator('#ai-style').inputValue(), 'realistic');
  assert.equal(calls, 0);
  await page.locator('[data-ai-view=list]').click();
  assert.equal(await page.locator('#ai-concept-board').getAttribute('data-view'), 'list');
  await page.locator('[data-ai-view=grid]').click();
  assert.equal(await page.locator('#ai-concept-board').getAttribute('data-view'), 'grid');
  const ingredients = featuredIngredientIds.slice(0, 3);
  for (const ingredient of ingredients) {
    await page.locator(`[data-ai-ingredient=${ingredient}]`).click();
    assert.equal(
      await page.locator(`[data-ai-ingredient=${ingredient}]`).getAttribute('aria-pressed'),
      'true',
    );
  }
  await page.locator('[data-ai-ingredient=custom]').click();
  await page.locator('#ai-ingredient-custom').fill('tiny mushrooms');
  await page.locator('[data-ai-add-ingredient]').click();
  await page.getByRole('button', { name: 'Remove detail: tiny mushrooms', exact: true }).click();
  assert.equal(
    await page.getByRole('button', { name: 'Remove detail: tiny mushrooms', exact: true }).count(),
    0,
  );
  await page.locator('#ai-ingredient-custom').fill('three blue balloons');
  await page.locator('[data-ai-add-ingredient]').click();
  await page.locator('[data-ai-mood=cozy]').click();
  await page.locator('[data-ai-swatch]').first().click();
  await page.locator('#ai-prompt').fill(originalDescription);
  await page.locator('#ai-transparent').uncheck();
  report.checks.push(
    'Catalog example, 20-style dialog, ingredient add/remove, mood, color and grid/list controls work without inference',
  );
  await page.locator('#ai-generate').click();
  await page.locator('#ai-canvas').waitFor({ state: 'visible' });
  await page.locator('#ai-status').filter({ hasText: 'ready' }).waitFor();
  assert.equal(calls, 1);
  assert.equal(lastBody.style, 'realistic');
  assert.equal(lastBody.turnstileToken, 'fixture-token');
  assert.ok(lastBody.prompt.startsWith(originalDescription));
  for (const detail of [
    ...ingredients.map((id) => examples.find((x) => x.id === id).ingredient),
    'three blue balloons',
    'Mood: warm and cozy atmosphere',
    'Accent colors:',
  ])
    assert.ok(lastBody.prompt.includes(detail), detail);
  assert.ok(!lastBody.prompt.includes('tiny mushrooms'));
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
  await page.locator('#ai-refine-tools > summary').click();
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
  const webpMetadata = await sharp(webp).metadata();
  assert.equal(webpMetadata.hasAlpha, true);
  const pdfPromise = page.waitForEvent('download');
  await page.locator('[data-ai-action=pdf]').click();
  await (await pdfPromise).saveAs(`${output}/clipart.pdf`);
  const pdf = await fs.readFile(`${output}/clipart.pdf`);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(
    pdf.includes(Buffer.from('/DeviceCMYK')),
    'PDF must contain real CMYK image color space',
  );
  assert.ok(pdf.byteLength <= 1000000, 'Default 1 MB PDF guard must hold');
  report.checks.push(
    'Actual alpha WebP, valid editable project and native CMYK PDF under 1 MB downloaded',
  );
  await page.reload();
  await page.locator('.ai-history-section > summary').click();
  await page.locator('#ai-history button').waitFor();
  await page.locator('#ai-history button').first().click();
  await page.locator('#ai-canvas').waitFor({ state: 'visible' });
  assert.equal((await pixels()).w, 512);
  report.checks.push('IndexedDB reload restores latest edited dimensions');
  await page.locator('#ai-refine-tools > summary').click();
  await page.locator('#ai-transparent').check();
  await page.locator('#ai-prompt').fill('A second example for transparent cutout');
  await page.locator('#ai-generate').click();
  await page.locator('#ai-status').filter({ hasText: 'Light background removed' }).waitFor();
  await page.waitForFunction(
    () => document.querySelector('#ai-history-count').textContent === '2 images',
  );
  assert.equal(calls, 2);
  assert.ok((await pixels()).transparent > 0);
  await page.locator('#ai-concept-count-trigger').click();
  await page.locator('#ai-choice-dialog [data-ai-choice-value="2"]').click();
  assert.equal(await page.locator('#ai-concepts button').count(), 2);
  await page.locator('#ai-concept-count-trigger').click();
  await page.locator('#ai-choice-dialog [data-ai-choice-value="8"]').click();
  assert.equal(await page.locator('#ai-concepts button').count(), 2);
  await page.locator('#ai-concepts button').nth(1).click();
  await page.waitForFunction(() => document.querySelector('#ai-canvas').width === 512);
  await page.locator('#ai-concepts button').first().click();
  await page.waitForFunction(() => document.querySelector('#ai-canvas').width === 1024);
  assert.equal(calls, 2);
  report.checks.push(
    'Checked transparency invokes real local cutout; concept history/count switches recorded images without generating extras',
  );
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
  await page.locator('#ai-status').filter({ hasText: 'Please wait one minute' }).waitFor();
  assert.equal(calls, 3);
  assert.ok(await page.locator('#ai-canvas').isVisible());
  report.checks.push('429 has honest error, retains old image, no retry');
  assert.deepEqual(errors, []);
  report.errors = errors;
  report.status = 'passed';
  await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  report.status = 'failed';
  report.failure = String(error);
  report.errors = errors;
  await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  throw error;
} finally {
  await browser.close();
}
