import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { inspectSpacing } from '../helpers/spacing-audit.mjs';
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4353';
const engine = process.env.UC_BROWSER ?? 'chromium';
const out = `reports/category-discovery/${engine}`;
mkdirSync(out, { recursive: true });
const art = JSON.parse(readFileSync(new URL('../../data/art.json', import.meta.url)));
const topics = [
  ...JSON.parse(readFileSync(new URL('../../data/topics.json', import.meta.url))).topics,
  ...JSON.parse(readFileSync(new URL('../../data/extra-topics.json', import.meta.url))),
];
const counts = new Map();
for (const item of art.filter((item) => item.published && item.indexable))
  counts.set(item.topic, (counts.get(item.topic) ?? 0) + 1);
const available = topics.filter((topic) => counts.has(topic.slug));
const browser = await { chromium, firefox, webkit }[engine].launch({
  ...(process.env.BROWSER_BIN ? { executablePath: process.env.BROWSER_BIN } : {}),
});
const context = await browser.newContext();
const page = await context.newPage();
const report = { base, engine, viewports: [], checks: [], errors: [], status: 'running' };
page.on('pageerror', (error) => report.errors.push(error.message));
const visible = () => page.locator('[data-topic]:not([hidden])');
try {
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base + '/categories/');
    if (base.includes('127.0.0.1'))
      await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
    await expect(page.locator('#discovery-controls')).toBeVisible();
    await expect(visible()).toHaveCount(Math.min(12, available.length));
    await expect(page.locator('#discovery-controls')).toHaveAttribute('data-ready', 'true');
    const initiallyOpen = await page.locator('#discovery-controls').evaluate((el) => el.open);
    assert.equal(initiallyOpen, width >= 980, 'Filters start expanded only on desktop');
    if (width < 980) {
      await page.locator('#discovery-controls > summary').click();
      await expect(page.locator('#topic-filter')).toBeVisible();
    }
    const layout = await page.evaluate(() => {
      const side = document.querySelector('.discovery-sidebar').getBoundingClientRect();
      const results = document.querySelector('.discovery-directory').getBoundingClientRect();
      return {
        side: { x: side.x, y: side.y, right: side.right, bottom: side.bottom },
        results: { x: results.x, y: results.y },
      };
    });
    if (width >= 980) {
      assert.ok(layout.side.right < layout.results.x, 'Filters remain to the left of results');
      assert.ok(
        Math.abs(layout.side.y - layout.results.y) < 2,
        'Sidebar and results start together',
      );
    } else assert.ok(layout.side.bottom <= layout.results.y, 'Mobile filters remain above results');
    await expect(page.locator('main h1')).toHaveCount(1);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    const spacing = await page.evaluate(inspectSpacing);
    assert.ok(
      spacing.uncoveredDocumentTail < 3,
      `Uncovered space after footer: ${spacing.uncoveredDocumentTail}px`,
    );
    assert.ok(
      spacing.contentFooterGap >= 0 && spacing.contentFooterGap <= 64,
      `Excess trailing space: ${spacing.contentFooterGap}px`,
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images]
          .filter((image) => image.closest('[hidden]') === null)
          .map(async (image) => {
            image.loading = 'eager';
            await image.decode();
          }),
      );
    });
    const audit = await new AxeBuilder({ page })
      .setLegacyMode(engine === 'webkit')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    assert.deepEqual(
      audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      [],
    );
    const targets = await page
      .locator(
        '.category-discovery button:visible, .category-discovery input:not([type=radio]):visible, .collection-filter-option:visible, .category-discovery summary:visible, .category-discovery select:visible',
      )
      .evaluateAll((elements) =>
        elements.map((el) => ({ id: el.id, height: el.getBoundingClientRect().height })),
      );
    assert.ok(
      targets.every((t) => t.height >= 44),
      JSON.stringify(targets),
    );
    if (width === 390 || width === 1440) {
      await page.screenshot({ path: `${out}/page-${width}.png`, fullPage: true });
      await page.locator('.discovery-hero').screenshot({ path: `${out}/hero-${width}.png` });
      await page
        .locator('.discovery-controls')
        .screenshot({ path: `${out}/collections-${width}.png` });
      await page.locator('footer.site-footer').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/bottom-${width}.png` });
    }
    report.viewports.push({
      width,
      accessibility: 'pass',
      overflow: false,
      images: 'decoded',
      contentFooterGap: spacing.contentFooterGap,
    });
  }
  const actualLinks = await page
    .locator('[data-topic] a')
    .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href')).sort());
  assert.deepEqual(actualLinks, available.map((topic) => `/clipart/${topic.slug}/`).sort());
  for (const topic of available) {
    const card = page.locator(`[data-topic] a[href="/clipart/${topic.slug}/"]`);
    await expect(card.locator('.subject-count')).toHaveText(
      `${counts.get(topic.slug)} illustrations`,
    );
  }
  const graph = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((scripts) => scripts.map((script) => JSON.parse(script.textContent)));
  const schema = graph.find((entry) => entry['@type'] === 'CollectionPage');
  assert.equal(schema.mainEntity.numberOfItems, available.length);
  assert.deepEqual(
    schema.mainEntity.itemListElement.map((item) => new URL(item.url).pathname).sort(),
    actualLinks,
  );
  assert.equal(schema.breadcrumb.itemListElement.length, 2);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    'https://ultraclipart.com/categories/',
  );
  await expect(page.locator('meta[name=robots]')).toHaveAttribute(
    'content',
    'index,follow,max-image-preview:large',
  );
  await expect(page.locator('meta[name=description]')).toHaveAttribute(
    'content',
    new RegExp(`${available.length} clipart topics`),
  );
  report.checks.push(
    'Published subject links, artwork counts, CollectionPage/ItemList/BreadcrumbList and canonical match the catalog',
  );

  await page.locator('#topic-filter').fill('  ＰＵＭＰＫＩＮ  ');
  await page.locator('#topic-filter').press('Enter');
  await expect(visible().first().locator('h3')).toHaveText('Pumpkin');
  await expect(page.locator('#topic-directory')).toBeFocused();
  await page.locator('#topic-filter').fill('baby elephant');
  await expect(visible().first().locator('h3')).toHaveText('Baby Elephant');
  await page
    .locator('label')
    .filter({ has: page.locator('[name="collection-filter"][value=sports]') })
    .click();
  await expect(page.locator('#no-topics')).toBeVisible();
  await page.locator('#clear-topic-filter').click();
  await expect(page.locator('#topic-filter')).toBeFocused();
  await expect(visible()).toHaveCount(12);
  await page.locator('.discovery-alphabet summary').click();
  await page.locator('[data-letter=K]').click();
  await expect(page.locator('[data-letter=K]')).toHaveAttribute('aria-pressed', 'true');
  assert.ok(
    (await visible().evaluateAll((cards) => cards.map((card) => card.dataset.name))).every((name) =>
      name.startsWith('K'),
    ),
  );
  const expectedK = await page
    .locator('[data-topic]')
    .evaluateAll(
      (cards) =>
        cards.filter(
          (card) =>
            card.dataset.groups.split(' ').includes('animals-nature') &&
            card.dataset.letterValue === 'K',
        ).length,
    );
  await page
    .locator('label')
    .filter({ has: page.locator('[name="collection-filter"][value=animals-nature]') })
    .click();
  await expect(visible()).toHaveCount(expectedK);
  await page.reload();
  await expect(page.locator('[data-letter=K]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#category-group')).toHaveValue('animals-nature');
  await expect(visible()).toHaveCount(expectedK);
  await page.locator('#reset-subjects').click();
  await page.locator('#category-sort').selectOption('count');
  const ranked = await visible().evaluateAll((cards) =>
    cards.map((card) => Number(card.dataset.count)),
  );
  assert.deepEqual(
    ranked,
    [...ranked].sort((a, b) => b - a),
  );
  await page.locator('#reset-subjects').click();
  let shown = Math.min(12, available.length);
  while (shown < available.length) {
    await page.locator('#show-more-subjects').click();
    shown = Math.min(shown + 12, available.length);
    await expect(visible()).toHaveCount(shown);
    assert.equal(
      await page.evaluate(() => document.activeElement.closest('[data-topic]') !== null),
      true,
    );
  }
  await expect(page.locator('#show-more-subjects')).toBeHidden();
  await page.locator('#topic-filter').fill('zz-no-such-subject');
  await expect(page.locator('#no-topics')).toBeVisible();
  await page.locator('#clear-topic-filter').click();
  await expect(visible()).toHaveCount(12);
  report.checks.push(
    'Keyboard search, Unicode normalization, multiword search, combined filters, shareable state, sort, progressive loading and empty-state recovery',
  );

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base + '/categories/?q=sunflower');
    await expect(visible().first().locator('h3')).toHaveText('Sunflower');
    await visible().first().locator('a').click();
    await page.waitForURL('**/clipart/sunflower/');
    await expect(page.locator('main h1')).toContainText('Sunflower');
  }
  report.checks.push('Filtered subject links navigate correctly on desktop and mobile');

  const noJS = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noJS.newPage();
  await staticPage.goto(base + '/categories/');
  await expect(staticPage.locator('[data-topic]:visible')).toHaveCount(available.length);
  await expect(staticPage.locator('#discovery-controls')).toBeVisible();
  await expect(staticPage.locator('#topic-filter')).toBeVisible();
  await expect(staticPage.locator('#category-filters')).toBeHidden();
  await expect(staticPage.locator('[data-directory-tools]')).toBeHidden();
  await expect(staticPage.locator('#hero-topic-search')).toHaveAttribute('action', '/search/');
  await noJS.close();
  report.checks.push(
    'All subject links remain visible and the search form has a native fallback without JavaScript',
  );
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  throw error;
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await browser.close();
}
