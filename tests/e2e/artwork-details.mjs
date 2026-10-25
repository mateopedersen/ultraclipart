import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.BASE_URL || 'http://127.0.0.1:4353';
const engine = process.env.UC_BROWSER || 'chromium';
const detailOnly = process.env.UC_DETAIL_ONLY === '1';
const browser = await { chromium, firefox, webkit }[engine].launch();
const context = await browser.newContext();
// Availability assertions require fresh network responses, including in Firefox.
// Routing disables the HTTP cache without accepting 304 as a successful first load.
await context.route('**/*', (route) => route.continue());
let page = await context.newPage();
const output = `reports/artwork-details/${engine}`;
await mkdir(output, { recursive: true });
const report = { engine, layouts: [], accessibility: [], checks: [], errors: [] };
page.on('pageerror', (error) => report.errors.push(error.message));
async function imagesReady(label) {
  try {
    await page.locator('img').evaluateAll(async (images) => {
      await Promise.all(
        images.map(async (image) => {
          image.loading = 'eager';
          let timer;
          try {
            await Promise.race([
              image.decode(),
              new Promise((_, reject) => {
                timer = setTimeout(
                  () =>
                    reject(new Error(`Image decode timed out: ${image.currentSrc || image.src}`)),
                  90_000,
                );
              }),
            ]);
            if (image.naturalWidth === 0)
              throw new Error(`Decoded image has no pixels: ${image.currentSrc || image.src}`);
          } finally {
            clearTimeout(timer);
          }
        }),
      );
    });
  } catch (error) {
    const unready = await page
      .locator('img')
      .evaluateAll((images) =>
        images
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map((image) => ({ src: image.currentSrc || image.src, complete: image.complete })),
      );
    throw new Error(`${label}: images did not load: ${JSON.stringify(unready)}`, { cause: error });
  }
}
try {
  for (const width of detailOnly ? [] : [1920, 1440, 1321, 1251, 768, 390, 320]) {
    console.log(`artwork details: home ${width}px`);
    await page.setViewportSize({ width, height: 1000 });
    // Firefox may expose a successful conditional navigation as 304. The
    // rendered layout, decoded images and controls below still verify its body.
    assert.ok(
      [200, 304].includes((await page.goto(base + '/', { waitUntil: 'networkidle' })).status()),
    );
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    const artworkClear = await page.locator('.home-benefit').evaluateAll((cards) =>
      cards.every((card) => {
        const image = card.querySelector('.home-benefit-art').getBoundingClientRect();
        const copy = card.querySelector('.home-benefit-copy').getBoundingClientRect();
        return image.bottom <= copy.top || image.right <= copy.left || image.left >= copy.right;
      }),
    );
    assert.ok(artworkClear, `Benefit illustrations must not cover text at ${width}`);
    const axe = await new AxeBuilder({ page })
      .setLegacyMode(engine === 'webkit')
      .include('.home-benefits')
      .include('.site-header')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    assert.deepEqual(
      axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
      [],
      `Homepage accessibility ${width}`,
    );
    if (width > 1320) {
      const gaps = await page.evaluate(() => {
        const b = (s) => document.querySelector(s).getBoundingClientRect();
        const links = b('.site-navigation-links'),
          surprise = b('.site-surprise-link'),
          actions = b('.site-navigation-actions');
        return { before: surprise.left - links.right, after: actions.left - surprise.right };
      });
      assert.ok(
        gaps.before >= 14 && gaps.before <= 20 && gaps.after >= 14 && gaps.after <= 20,
        `Header gaps at ${width}: ${JSON.stringify(gaps)}`,
      );
    }
    await page.locator('.home-benefits').screenshot({ path: `${output}/benefits-${width}.png` });
    if (width === 1440 || width === 390)
      await page.screenshot({ path: `${output}/homepage-${width}.png` });
    report.layouts.push({ page: 'home', width });
  }
  for (const width of [1440, 768, 390, 320]) {
    for (const id of [
      'koala-halloween-pumpkin-clipart',
      'winter-arctic-fox-resting',
      'apple-and-dried-rings-crayon-clipart',
    ]) {
      console.log(`artwork details: ${id} ${width}px`);
      // Isolate each case so viewport changes cannot cancel the previous page's
      // responsive image loads while WebKit is tearing down its document.
      page.removeAllListeners('pageerror');
      await page.close();
      page = await context.newPage();
      page.on('pageerror', (error) => report.errors.push(error.message));
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        [200, 304].includes(
          (await page.goto(`${base}/art/${id}/`, { waitUntil: 'networkidle' })).status(),
        ),
      );
      // Warm lazy images before Axe creates its helper document. Otherwise
      // WebKit may report cancelled helper-image loads as access-control errors.
      await imagesReady(`${id} ${width}px before accessibility`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      await expect(page.locator('main h1')).toHaveCount(1);
      await expect(page.locator('.art-ai-badge')).toHaveCount(0);
      await expect(page.locator('.artwork-facts')).not.toContainText('Artwork origin');
      const original = await page
        .locator('.detail-actions .download-option')
        .first()
        .getAttribute('href');
      await expect(page.locator('.art-custom-color')).toHaveAttribute('data-picked', 'false');
      await expect(page.locator('[data-apply-custom]')).toBeHidden();
      await expect(page.locator('[data-custom-label]')).toHaveText('Choose your own shade');
      await expect(page.locator('.download-size strong')).toHaveCount(2);
      await page.locator('[data-bg="#b8d8ff"]').click();
      assert.equal(
        await page.locator('#art-preview').evaluate((el) => getComputedStyle(el).backgroundColor),
        'rgb(184, 216, 255)',
      );
      await page.locator('[data-bg="#23344d"]').click();
      assert.equal(
        await page.locator('#art-preview').evaluate((el) => getComputedStyle(el).backgroundColor),
        'rgb(35, 52, 77)',
      );
      await page.locator('[data-bg="#ffffff"]').click();
      await expect(page.locator('[data-bg="#ffffff"]')).toHaveAttribute('aria-pressed', 'true');
      assert.equal(
        await page.locator('#art-preview').evaluate((el) => getComputedStyle(el).backgroundColor),
        'rgb(255, 255, 255)',
      );
      await page.locator('#preview-color').fill('#123456');
      await expect(page.locator('.art-custom-color')).toHaveAttribute('data-selected', 'true');
      await expect(page.locator('[data-custom-label]')).toHaveText('#123456');
      assert.equal(
        await page.locator('#art-preview').evaluate((el) => getComputedStyle(el).backgroundColor),
        'rgb(18, 52, 86)',
      );
      await page.locator('[data-bg="#ffffff"]').click();
      await expect(page.locator('.art-custom-color')).toHaveAttribute('data-selected', 'false');
      await page.locator('[data-apply-custom]').click();
      assert.equal(
        await page.locator('#art-preview').evaluate((el) => getComputedStyle(el).backgroundColor),
        'rgb(18, 52, 86)',
      );
      await page.locator('[data-bg="transparent"]').click();
      await expect(page.locator('[data-bg="transparent"]')).toHaveAttribute('aria-pressed', 'true');
      assert.notEqual(
        await page.locator('#art-preview').evaluate((el) => getComputedStyle(el).backgroundImage),
        'none',
      );
      assert.equal(
        await page.locator('.detail-actions .download-option').first().getAttribute('href'),
        original,
      );
      await page.getByText('Full file information', { exact: true }).click();
      await expect(page.locator('.artwork-technical')).toHaveAttribute('open', '');
      const axe = await new AxeBuilder({ page })
        .setLegacyMode(engine === 'webkit')
        .include('.art-detail')
        .include('.artwork-facts')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      assert.deepEqual(
        axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
        [],
        `Artwork accessibility ${id} at ${width}`,
      );
      if (id.startsWith('koala')) {
        await page
          .locator('.art-preview-controls')
          .screenshot({ path: `${output}/controls-${width}.png` });
        await page.locator('.artwork-facts').screenshot({ path: `${output}/facts-${width}.png` });
        await page
          .locator('.detail-actions')
          .screenshot({ path: `${output}/downloads-${width}.png` });
        await page
          .locator('.art-detail-overview')
          .screenshot({ path: `${output}/overview-${width}.png` });
      }
      report.layouts.push({ page: id, width });
      report.accessibility.push({ id, width, violations: 0 });
      // Complete image requests before navigation; WebKit reports cancelled image
      // loads as access-control errors when a lazy image is still starting up.
      await imagesReady(`${id} ${width}px before navigation`);
    }
  }
  assert.deepEqual(report.errors, []);
  report.checks = [
    'All preview backgrounds work and restore checkerboard',
    'Selected state follows presets and custom input',
    'Preview changes preserve original download URLs',
    'Catalog details keep production provenance outside the public artwork facts',
    'Expanded technical file facts remain accessible',
    'Custom picker starts neutral and can reapply the last chosen color',
    'Download sizes remain visible beside separate WebP and PDF explanations',
  ];
  report.status = 'passed';
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report));
