import { chromium, firefox, webkit, expect } from '@playwright/test';
import { defaults, searchArtwork } from '../../src/lib/search.ts';
import { primaryClusterForTopic, clustersForTopic } from '../../src/lib/topic-clusters.ts';
import { auditMonochrome } from '../../scripts/monochrome-catalog.mjs';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.BASE_URL || 'http://127.0.0.1:4335';
const engine = process.env.UC_BROWSER || 'chromium';
const topic = process.env.TOPIC || 'volleyball';
const out = resolve(process.env.EVIDENCE_DIR || `reports/${topic}`, engine);
// A live release may precede locally staged collections. Bind expected search
// results and downloads to that release, rather than silently mixing revisions.
const expectedRevision = process.env.EXPECTED_REVISION;
assert.ok(
  !process.env.RELEASE_DATA_DIR || /^[0-9a-f]{40}$/.test(expectedRevision ?? ''),
  'Release snapshots require an exact expected Git revision',
);
const readData = (name) =>
  JSON.parse(
    readFileSync(
      process.env.RELEASE_DATA_DIR
        ? resolve(process.env.RELEASE_DATA_DIR, name)
        : new URL(`../../data/${name}`, import.meta.url),
    ),
  );
const all = readData('art.json');
const catalog = all.filter((a) => a.topic === topic);
const publication = readData('publication.json');
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
let page = await context.newPage();
const report = {
  base,
  engine,
  expectedRevision: expectedRevision ?? null,
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
    await page.goto(base + `/clipart/${topic}/`);
    if (expectedRevision)
      await expect(page.locator('meta[name="build-revision"]')).toHaveAttribute(
        'content',
        expectedRevision,
      );
    await expect(page.locator('.art-card')).toHaveCount(catalog.length);
    await page.evaluate(() => document.fonts.ready);
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const state = {
      width,
      overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      violations: audit.violations.map((v) => v.id),
      violationDetails: audit.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes })),
    };
    report.states.push(state);
    assert.equal(state.overflow, false);
    assert.deepEqual(state.violations, []);
    const previewHeights = await page
      .locator('.art-picture')
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    assert.ok(
      Math.max(...previewHeights) - Math.min(...previewHeights) <= 1,
      'Portrait and landscape previews must retain one shared gallery height',
    );
    const buttons = await page.locator('.card-actions').evaluateAll((groups) =>
      groups.map((group) => {
        const bounds = group.getBoundingClientRect();
        const button = group.firstElementChild.getBoundingClientRect();
        return {
          count: group.children.length,
          height: button.height,
          centered: Math.abs(bounds.x + bounds.width / 2 - button.x - button.width / 2) < 1,
        };
      }),
    );
    for (const button of buttons) {
      assert.equal(button.count, 1, 'One editor action below direct downloads');
      assert.ok(
        button.height >= 44 && button.centered,
        `${width}: centered, touch-friendly action`,
      );
    }
    if ([390, 1440].includes(width))
      await page.screenshot({ path: resolve(out, `gallery-${width}.png`), fullPage: false });
  }
  for (const a of catalog) {
    const card = page.locator(`.art-card[data-id="${a.id}"]`);
    await expect(card.locator('.art-picture > img')).toHaveAttribute('alt', a.alt);
    await expect(card.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute(
      'href',
      `/edit/${a.id}/`,
    );
    assert.equal(await card.locator('a[href^="/edit/"]').count(), 1);
    for (const kind of ['webp', 'pdf'])
      assert.equal(
        new URL(await card.locator(`a[data-download-format="${kind}"]`).getAttribute('href'), base)
          .href,
        expectedUrl(a, kind),
      );
    report.checkedPairs++;
  }
  await page.goto(base + `/search/?q=${topic}`);
  const topics = [...readData('topics.json').topics, ...readData('extra-topics.json')];
  const monochrome = await auditMonochrome(all);
  const searchable = all
    .filter((item) => item.published && item.indexable)
    .map((item) => {
      const entry = topics.find((entry) => entry.slug === item.topic);
      return {
        ...item,
        cluster: entry ? primaryClusterForTopic(entry) : '',
        topicLabel: entry?.keyword || item.topic,
        keywords: entry ? [entry.keyword] : [],
        collections: entry
          ? clustersForTopic(entry).map((cluster) =>
              cluster
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, ''),
            )
          : [],
        monochrome: monochrome.get(item.id)?.monochrome === true,
        monochromeKind: monochrome.get(item.id)?.kind ?? null,
      };
    });
  const expected = (style = '') =>
    searchArtwork(searchable, { ...defaults, q: topic, style }).total;
  await expect(page.locator('#result-count')).toContainText(
    `${expected().toLocaleString('en-US')} artworks`,
  );
  await expect(page.locator('#result-count')).toContainText(`for “${topic}”`);
  await expect(page.locator('#search-results .card-actions').first()).toContainText('Edit');
  for (const style of ['watercolor', 'black & white']) {
    await page.selectOption('#filter-style', style);
    await expect(page.locator('#search-results .art-card')).toHaveCount(
      Math.min(8, expected(style)),
    );
  }
  const downloads =
    process.env.ALL_DOWNLOADS === '1'
      ? catalog
      : [
          ...new Map(
            [
              catalog[0],
              catalog.find((a) => a.style === 'Outline'),
              catalog.find((a) => a.style === 'Watercolor'),
            ]
              .filter(Boolean)
              .map((item) => [item.id, item]),
          ).values(),
        ];
  for (const a of downloads) {
    // Isolate each artwork's native downloads from Chromium's per-tab burst limit.
    await page.close();
    page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(base + `/art/${a.id}/`);
    const image = page.locator('#art-preview img');
    await expect(image).toHaveAttribute('alt', a.alt);
    await image.evaluate((img) => img.decode());
    for (const kind of ['webp', 'pdf']) {
      await page.goto(`${base}/art/${a.id}/`);
      const entry = page.locator(`.detail-actions a[data-download-format="${kind}"]`);
      assert.equal(await entry.evaluate((a) => a.href), expectedUrl(a, kind));
      await entry.click();
      await expect(page.locator(`#download-dialog [data-final-download="${kind}"]`)).toBeVisible();
      assert.equal(page.url(), `${base}/art/${a.id}/`);
      const link = page.locator(`[data-final-download="${kind}"]`);
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
  await staticPage.goto(base + `/clipart/${topic}/`);
  await expect(staticPage.locator('.art-card')).toHaveCount(catalog.length);
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
