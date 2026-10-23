import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.BASE_URL || 'http://127.0.0.1:4335';
const engine = process.env.UC_BROWSER || 'chromium';
const out = resolve(process.env.EVIDENCE_DIR || 'reports/volleyball', engine);
const catalog = JSON.parse(readFileSync(new URL('../../data/art.json', import.meta.url))).filter(
  (a) => a.topic === 'volleyball',
);
const publication = JSON.parse(
  readFileSync(new URL('../../data/publication.json', import.meta.url)),
);
const expectedUrl = (a, kind) =>
  base.startsWith('https:')
    ? publication.files.find((f) => f.assetId === a.id && f.kind === kind).url
    : new URL(a[kind], base).href;
mkdirSync(out, { recursive: true });
const browser = await { chromium, firefox, webkit }[engine].launch({
  headless: true,
  ...(process.env.BROWSER_BIN ? { executablePath: process.env.BROWSER_BIN } : {}),
});
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const report = {
  base,
  engine,
  states: [],
  downloads: [],
  checkedPairs: 0,
  errors: [],
  status: 'running',
};
page.on('pageerror', (error) => report.errors.push(error.message));
try {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + '/clipart/volleyball/');
    await expect(page.locator('.art-card')).toHaveCount(50);
    await page.evaluate(() => document.fonts.ready);
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const state = {
      width,
      overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      violations: audit.violations.map((v) => v.id),
    };
    report.states.push(state);
    assert.equal(state.overflow, false);
    assert.deepEqual(state.violations, []);
    const buttons = await page.locator('.card-actions').evaluateAll((groups) =>
      groups.map((group) =>
        [...group.children].map((button) => {
          const r = button.getBoundingClientRect();
          return { top: r.top, left: r.left, height: r.height, width: r.width };
        }),
      ),
    );
    for (const [a, b] of buttons)
      for (const dimension of ['height', 'width'])
        assert.ok(
          Math.abs(a[dimension] - b[dimension]) <= 1,
          `${width}: ${dimension} misalignment`,
        );
    for (const [a, b] of buttons)
      assert.ok(
        Math.abs(a.top - b.top) <= 1 || Math.abs(a.left - b.left) <= 1,
        'Responsive buttons must align in a row or column',
      );
    if ([390, 1440].includes(width))
      await page.screenshot({ path: resolve(out, `gallery-${width}.png`), fullPage: false });
  }
  for (const a of catalog) {
    const card = page.locator(`.art-card[data-id="${a.id}"]`);
    await expect(card.locator('img')).toHaveAttribute('alt', a.alt);
    await expect(card.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute(
      'href',
      `/edit/${a.id}/`,
    );
    assert.equal(await card.locator('a[href^="/edit/"]').count(), 1);
    for (const kind of ['webp', 'pdf'])
      assert.equal(
        await card.locator(`a[download="${a.id}.${kind}"]`).evaluate((a) => a.href),
        expectedUrl(a, kind),
      );
    report.checkedPairs++;
  }
  await page.goto(base + '/search/?q=volleyball');
  await expect(page.locator('#result-count')).toHaveText('50 illustrations for “volleyball”');
  await expect(page.locator('#search-results .card-actions').first()).toContainText('Edit');
  await page.selectOption('#filter-style', 'watercolor');
  await expect(page.locator('#search-results .art-card')).toHaveCount(3);
  await page.selectOption('#filter-style', 'black & white');
  await expect(page.locator('#search-results .art-card')).toHaveCount(7);
  const downloads =
    process.env.ALL_DOWNLOADS === '1'
      ? catalog
      : [
          catalog[0],
          catalog.find((a) => a.style === 'Outline'),
          catalog.find((a) => a.style === 'Watercolor'),
        ];
  for (const a of downloads) {
    await page.goto(base + `/art/${a.id}/`);
    const image = page.locator('#art-preview img');
    await expect(image).toHaveAttribute('alt', a.alt);
    await image.evaluate((img) => img.decode());
    for (const kind of ['webp', 'pdf']) {
      const link = page.locator(`.detail-actions a[download="${a.id}.${kind}"]`);
      assert.equal(await link.evaluate((a) => a.href), expectedUrl(a, kind));
      const pending = page.waitForEvent('download');
      await link.click();
      const download = await pending;
      assert.equal(download.suggestedFilename(), `${a.id}.${kind}`);
      const path = await download.path();
      const bytes = readFileSync(path);
      const hash = createHash('sha256').update(bytes).digest('hex');
      assert.equal(hash, a.files[kind].sha256);
      assert.equal(bytes.length, a.files[kind].bytes);
      report.downloads.push({ id: a.id, kind, bytes: bytes.length, sha256: hash });
      await download.delete();
    }
  }
  await page.goto(base + `/art/${catalog[0].id}/`);
  await page.screenshot({ path: resolve(out, 'detail.png'), fullPage: true });
  const staticContext = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await staticContext.newPage();
  await staticPage.goto(base + '/clipart/volleyball/');
  await expect(staticPage.locator('.art-card')).toHaveCount(50);
  await staticContext.close();
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  process.exitCode = 1;
  await page.screenshot({ path: resolve(out, 'failure.png'), fullPage: true }).catch(() => {});
} finally {
  writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, downloads: report.downloads.length }));
  await browser.close();
}
