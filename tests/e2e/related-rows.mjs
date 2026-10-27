import { chromium, webkit, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { readEditorialCatalog } from '../helpers/editorial-catalog.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
const fixturesOnly = process.env.ROWS_FIXTURES_ONLY === '1';
const output = 'reports/related-rows';
mkdirSync(output, { recursive: true });
const report = { fixtures: [], pages: [], errors: [] };
const css = readFileSync('src/styles/related.css', 'utf8');
const catalog = new Map(readEditorialCatalog().map((item) => [item.id, item]));
for (const [engine, implementation] of Object.entries({ chromium, webkit })) {
  const browser = await implementation.launch();
  try {
    const page = await browser.newPage();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      // Synthetic cards isolate the exact production row rules over every count.
      await page.setContent(
        `<style>*{box-sizing:border-box}${css}.related-card{height:50px}</style>` +
          Array.from(
            { length: 65 },
            (_, i) =>
              `<div class="related-discovery"><div class="related-group"><div class="related-grid" data-count="${i + 1}">${'<article class="related-card"></article>'.repeat(i + 1)}</div></div></div>`,
          ).join(''),
      );
      const failures = await page.locator('.related-grid').evaluateAll((grids) =>
        grids.flatMap((grid) => {
          const bounds = grid.getBoundingClientRect(),
            rows = new Map();
          for (const card of grid.children) {
            const box = card.getBoundingClientRect();
            const key = Math.round(box.top);
            rows.set(key, [...(rows.get(key) || []), box]);
          }
          return [...rows.values()].flatMap((row) => {
            const left = row[0].left,
              right = row.at(-1).right;
            const centeredSingle =
              row.length === 1 &&
              Math.abs((left + right) / 2 - (bounds.left + bounds.right) / 2) < 1;
            return (Math.abs(left - bounds.left) < 1 && Math.abs(right - bounds.right) < 1) ||
              centeredSingle
              ? []
              : [{ count: grid.dataset.count, left, right, bounds: [bounds.left, bounds.right] }];
          });
        }),
      );
      assert.equal(
        failures.length,
        0,
        `${engine} ${width}: ${JSON.stringify(failures.slice(0, 3))}`,
      );
      report.fixtures.push({ engine, width, counts: '1–65', passed: true });
    }
    if (!fixturesOnly) {
      await page.route('**/api/cookie-region.json', (route) =>
        route.fulfill({ contentType: 'application/json', body: '{"showNotice":false}' }),
      );
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const id of ['godzilla-clipart-atomic-breath-sideways', 'sunflower-straw-hat']) {
          const response = await page.goto(`${base}/art/${id}/`);
          assert.equal(response.status(), 200);
          const root = page.locator('[data-related-root]');
          await expect(root).toHaveAttribute('data-ready', 'true');
          await expect(root.locator('[data-collection-discovery] h3')).toHaveText(
            'Explore this collection',
          );
          await expect(root.locator('[data-collection-discovery]')).toBeVisible();
          const preview = root.locator('[data-collection-discovery]');
          const target = await preview.locator('a').getAttribute('href');
          const topic = target.split('/')[2];
          const examples = await preview
            .locator('[data-collection-preview-id]')
            .evaluateAll((images) =>
              images.map((img) => ({
                id: img.getAttribute('data-collection-preview-id'),
                alt: img.alt,
                title: img.title,
              })),
            );
          assert.ok(examples.length >= 1 && examples.length <= 3);
          for (const example of examples) {
            const artwork = catalog.get(example.id);
            assert.equal(artwork.topic, topic);
            assert.equal(example.alt, artwork.alt);
            assert.equal(example.title, artwork.title);
          }
          const more = root.locator('[data-related-more]');
          for (let i = 0; i < 20 && (await more.isVisible()); i++) {
            const before = await root.locator('.related-card').count();
            await more.click();
            await expect.poll(() => root.locator('.related-card').count()).toBeGreaterThan(before);
          }
          await expect(more).toBeHidden();
          const counts = await root
            .locator('.related-grid')
            .evaluateAll((grids) => grids.map((grid) => grid.children.length));
          assert.ok(counts.reduce((a, b) => a + b, 0) > 12);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
          const last = root.locator('.related-card').last();
          await last.scrollIntoViewIfNeeded();
          if (id.startsWith('godzilla'))
            await page.screenshot({ path: `${output}/${engine}-${width}-last-rows.png` });
          await preview.scrollIntoViewIfNeeded();
          await expect
            .poll(() =>
              preview
                .locator('img')
                .evaluateAll((images) =>
                  images.every((img) => img.complete && img.naturalWidth > 0),
                ),
            )
            .toBe(true);
          await preview.screenshot({ path: `${output}/collection-preview-${engine}-${width}.png` });
          const monochrome = root.locator('[data-related-mode="monochrome"]');
          if (await monochrome.isVisible()) {
            await monochrome.click();
            await expect(monochrome).toHaveAttribute('aria-pressed', 'true');
            assert.ok((await root.locator('.related-card').count()) > 0);
            await expect(root.locator('[data-collection-discovery]')).toBeVisible();
          }
          report.pages.push({ engine, width, id, counts, passed: true });
        }
      }
    }
  } catch (error) {
    report.errors.push({ engine, message: error.message });
  } finally {
    await browser.close();
  }
}
writeFileSync(
  `${output}/${fixturesOnly ? 'fixtures' : 'report'}.json`,
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    fixtures: report.fixtures.length * 65,
    pages: report.pages.length,
    errors: report.errors,
  }),
);
assert.deepEqual(report.errors, []);
