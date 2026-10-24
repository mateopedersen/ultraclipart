import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loadTypescript } from '../helpers/typescript.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4367';
const engine = process.env.UC_BROWSER || 'chromium';
const output = `reports/related/${engine}`;
const catalog = JSON.parse(await readFile('data/art.json', 'utf8'));
const { RelatedIndex } = await loadTypescript('src/lib/related/engine.ts');
const index = new RelatedIndex(catalog);
const reference = 'apple-and-dried-rings-crayon-clipart';
const topics = [
  'apple',
  'orange',
  'kiwi',
  'kiwi-fruit',
  'strawberry',
  'cat',
  'baby',
  'baby-elephant',
  'turkey',
  'headphones',
  'volleyball',
  'winter',
];
const samples = topics.map((topic) =>
  topic === 'apple'
    ? reference
    : [...index.profiles.values()].find(
        (p) =>
          p.item.topic === topic && p.eligible && index.snapshot(p.item.id).alternatives.length,
      )?.item.id,
);
assert.ok(samples.every(Boolean));
await mkdir(output, { recursive: true });
const browser = await { chromium, firefox, webkit }[engine].launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [],
  report = { engine, base, layouts: [], accessibility: [], checks: [], errors };
page.on('pageerror', (error) => errors.push(error.message));
await page.addInitScript(() => {
  window.relatedEvents = [];
  window.addEventListener('ultraclipart:related', (e) => window.relatedEvents.push(e.detail));
  window.relatedCls = 0;
  if (PerformanceObserver.supportedEntryTypes.includes('layout-shift'))
    new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries())
        if (!entry.hadRecentInput) window.relatedCls += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
});
try {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const id of samples) {
      const response = await page.goto(`${base}/art/${id}/`, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      const root = page.locator('[data-related-root]');
      await expect(root).toHaveAttribute('data-ready', 'true');
      await expect(page.locator('[data-related-results]')).toBeVisible();
      await root.scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth),
        width,
        `overflow ${id} ${width}`,
      );
      const count = await root.locator('.related-card').count();
      assert.ok(count <= (width > 900 ? 12 : 6));
      const layout = await root
        .locator('.related-grid:visible')
        .first()
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      assert.equal(layout, width > 900 ? 4 : width < 360 ? 1 : 2);
      const snapshot = await page.locator('[data-related-snapshot]').textContent();
      assert.ok(Buffer.byteLength(snapshot) < 64000);
      await root.locator('img').evaluateAll(async (images) => {
        await Promise.all(
          images.map(async (img) => {
            img.loading = 'eager';
            await img.decode();
          }),
        );
      });
      assert.ok(
        await root
          .locator('img')
          .evaluateAll((images) =>
            images.every(
              (img) => img.naturalWidth > 0 && getComputedStyle(img).objectFit === 'contain',
            ),
          ),
      );
      const overlap = await root.locator('.related-card-actions').evaluateAll((rows) =>
        rows.some((row) => {
          const visible = [...row.children]
            .filter((el) => !el.hidden)
            .map((el) => el.getBoundingClientRect());
          return visible.some((a, i) =>
            visible.some(
              (b, j) =>
                i < j &&
                a.left < b.right - 1 &&
                a.right > b.left + 1 &&
                a.top < b.bottom - 1 &&
                a.bottom > b.top + 1,
            ),
          );
        }),
      );
      assert.equal(overlap, false);
      if (id === reference) {
        const axe = await new AxeBuilder({ page })
          .setLegacyMode(engine === 'webkit')
          .include('[data-related-root]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        assert.deepEqual(
          axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
          [],
        );
        report.accessibility.push({ width, violations: 0 });
        if (width === 1440 || width === 390)
          await root.screenshot({ path: `${output}/reference-${width}.png` });
      }
      report.layouts.push({
        id,
        width,
        cards: count,
        snapshotBytes: Buffer.byteLength(snapshot),
        cls: await page.evaluate(() => window.relatedCls),
      });
    }
  }
  report.checks.push(
    'T20 responsive layouts, uncropped images, no control overlap',
    'T21 WCAG AA automated checks',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/art/${reference}/`, { waitUntil: 'networkidle' });
  const root = page.locator('[data-related-root]');
  await page.locator('[data-related-mode="subject"]').click();
  await expect(page.locator('[data-related-mode="subject"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('[data-related-companions]')).toBeHidden();
  while (await page.locator('[data-related-more]').isVisible()) {
    await page.locator('[data-related-more]').click();
    await expect(root).not.toHaveAttribute('aria-busy', 'true');
  }
  const ids = await root
    .locator('.related-card')
    .evaluateAll((nodes) => nodes.map((n) => n.dataset.relatedId));
  assert.equal(new Set(ids).size, ids.length);
  await page.locator('[data-related-mode="companions"]').click();
  await expect(page.locator('[data-related-alternatives]')).toBeHidden();
  await expect(root).toContainText('Dried Orange Slices Crayon');
  await page.locator('[data-related-mode="monochrome"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-related-mode="monochrome"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  assert.equal(
    await page
      .locator('[data-related-mode="monochrome"]')
      .evaluate((el) => getComputedStyle(el).outlineStyle),
    'solid',
  );
  const mono = await root
    .locator('.related-card')
    .evaluateAll((cards) => cards.map((c) => c.dataset.relatedId));
  assert.ok(mono.every((id) => index.profiles.get(id).colorMode === 'monochrome'));
  const favorite = root.locator('[data-related-favorite]').first();
  await favorite.click();
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  const savedId = await favorite.locator('xpath=ancestor::article').getAttribute('data-related-id');
  assert.ok(
    await page.evaluate(
      (id) => JSON.parse(localStorage.getItem('ultraclipart-favorites')).includes(id),
      savedId,
    ),
  );
  await favorite.click();
  await expect(favorite).toHaveAttribute('aria-pressed', 'false');
  report.checks.push(
    'T19 real filters, stable show-more, no duplicate cards',
    'T21 keyboard focus and toggle states',
    'Favorites use existing storage',
  );
  // Actual file bytes and types, including the original download controls.
  for (const selector of ['.detail-actions [download]', '[data-related-download]:visible']) {
    for (const link of await page
      .locator(selector)
      .all()
      .then((list) => list.slice(0, 2))) {
      const url = await link.getAttribute('href'),
        response = await context.request.get(new URL(url, base).href);
      assert.equal(response.status(), 200);
      const body = await response.body(),
        pdf = url.includes('.pdf');
      assert.ok(
        response.headers()['content-type'].includes(pdf ? 'application/pdf' : 'image/webp'),
      );
      const matches = catalog.flatMap((a) =>
        Object.entries(a.files)
          .filter(([kind]) => kind === (pdf ? 'pdf' : 'webp'))
          .map(([, f]) => f.sha256),
      );
      assert.ok(matches.includes(createHash('sha256').update(body).digest('hex')));
    }
  }
  report.checks.push('T23 main and related WebP/PDF downloads return original SHA-256 bytes');
  await page.locator('[data-related-mode="best"]').click();
  await page.locator('.related-card').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  const events = await page.evaluate(() => window.relatedEvents);
  assert.ok(events.some((e) => e.event === 'impression'));
  assert.ok(!events.some((e) => e.event === 'download_success'));
  const impressions = events.filter((e) => e.event === 'impression').map((e) => e.artworkId);
  assert.equal(impressions.length, new Set(impressions).size);
  report.checks.push(
    'Consent-neutral event hooks; visible-duration impressions; no fabricated download successes',
  );
  await page.route('**/related-release.json', async (route) => {
    await new Promise((r) => setTimeout(r, 1000));
    await route.continue();
  });
  await page.locator('[data-related-mode="subject"]').click();
  await expect(root).toHaveAttribute('aria-busy', 'true');
  await expect(root).not.toHaveAttribute('aria-busy', 'true');
  await page.unroute('**/related-release.json');
  await page.route('**/related-release.json', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  );
  await page.locator('[data-related-mode="companions"]').click();
  await expect(page.locator('[data-related-results]')).toBeHidden();
  await expect(page.locator('#art-preview img')).toBeVisible();
  await expect(page.locator('[data-related-status]')).toContainText('connection');
  await page.unroute('**/related-release.json');
  await page.locator('[data-related-mode="subject"]').click();
  await expect(page.locator('[data-related-results]')).toBeVisible();
  await page.route('**/related-release.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ version: 'new-publication' }),
    }),
  );
  await page.locator('[data-related-more]').click();
  await expect(page.locator('[data-related-results]')).toBeHidden();
  await expect(page.locator('[data-related-refresh]')).toBeVisible();
  await page.unroute('**/related-release.json');
  report.checks.push(
    'T15 deployed revision mismatch hides stale cards',
    'T22 slow service, retry, failure isolation',
  );
  const firstThumb = index.snapshot(reference).alternatives[0].id;
  await page.route(`**/*${firstThumb}*webp*`, (route) => route.abort());
  await page.goto(`${base}/art/${reference}/`, { waitUntil: 'networkidle' });
  const failed = page.locator(`[data-related-id="${firstThumb}"]`);
  await failed.scrollIntoViewIfNeeded();
  await expect(failed.locator('.related-image-error')).toBeVisible();
  await expect(failed.locator('[data-related-download]:visible')).toHaveCount(0);
  report.checks.push(
    'T22 failed thumbnail removes download actions and preserves detail navigation',
  );
  const nojs = await browser.newContext({ javaScriptEnabled: false }),
    plain = await nojs.newPage();
  await plain.goto(`${base}/art/${reference}/`);
  const staticLinks = await plain.locator('[data-related-root] [data-related-detail]').count();
  assert.ok(staticLinks >= 4);
  await expect(plain.locator('[data-related-controls]')).toBeHidden();
  await expect(plain.locator('.detail-actions [download]')).toHaveCount(2);
  await nojs.close();
  report.checks.push('T24 server-rendered links and original downloads work without JavaScript');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
