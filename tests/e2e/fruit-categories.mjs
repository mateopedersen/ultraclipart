import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { primaryClusterForTopic } from '../../src/lib/topic-clusters.ts';
const read = (p) => JSON.parse(fs.readFileSync(p));
const art = read('data/art.json'),
  topics = [...read('data/topics.json').topics, ...read('data/extra-topics.json')];
const expected = topics.filter(
  (t) => primaryClusterForTopic(t) === 'Food & drink' && art.some((a) => a.topic === t.slug),
);
const autumnTopics = topics.filter(
  (t) =>
    primaryClusterForTopic(t) === 'Thanksgiving & Autumn' && art.some((a) => a.topic === t.slug),
);
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4353';
const browser = await chromium.launch(),
  page = await browser.newPage();
const report = { foodTopics: expected.length, errors: [], checks: [] };
page.on('pageerror', (e) => report.errors.push(e.message));
try {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(base + '/categories/?collection=food-drink');
    await expect(page.locator('#category-group')).toHaveValue('food-drink');
    while (await page.locator('#show-more-subjects').isVisible())
      await page.locator('#show-more-subjects').click();
    const links = await page
      .locator('[data-topic]:not([hidden]) a')
      .evaluateAll((xs) => xs.map((x) => x.getAttribute('href')).sort());
    assert.deepEqual(links, expected.map((t) => `/clipart/${t.slug}/`).sort());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const filters = page.locator('#discovery-controls');
    if (!(await filters.evaluate((element) => element.open)))
      await filters.locator(':scope > summary').click();
    const visibleTopics = page.locator('#subject-grid [data-topic]:not([hidden]) a');
    await page.locator('#topic-filter').fill('cranberry');
    await expect(page).toHaveURL(
      /collection=food-drink.*q=cranberry|q=cranberry.*collection=food-drink/,
    );
    await expect(
      page.locator('#subject-grid [data-topic]:not([hidden]) a[href="/clipart/cranberry/"]'),
    ).toHaveCount(1);
    await expect(visibleTopics.first()).toHaveAttribute('href', '/clipart/cranberry/');
    // Finish the autocomplete interaction before choosing a filter behind its panel.
    const topicFilter = page.locator('#topic-filter');
    await expect(topicFilter).toHaveAttribute('aria-expanded', 'true');
    await topicFilter.press('Escape');
    await expect(topicFilter).toHaveAttribute('aria-expanded', 'false');
    await expect(topicFilter).toHaveValue('cranberry');
    if (!(await filters.evaluate((element) => element.open)))
      await filters.locator(':scope > summary').click();
    const autumn = page.locator('[name="collection-filter"][value="thanksgiving-autumn"]');
    const autumnLabel = page.locator('label').filter({ has: autumn });
    await expect(autumnLabel).toBeVisible();
    await autumnLabel.click();
    await expect(autumn).toBeChecked();
    await expect(page.locator('#category-group')).toHaveValue('thanksgiving-autumn');
    // Primary browse groups are exclusive; seasonal associations remain separate.
    await expect(page).toHaveURL(
      /collection=thanksgiving-autumn.*q=cranberry|q=cranberry.*collection=thanksgiving-autumn/,
    );
    await expect(
      page.locator('#subject-grid [data-topic]:not([hidden]) a[href="/clipart/cranberry/"]'),
    ).toHaveCount(0);
    const autumnMatches = await visibleTopics.evaluateAll((xs) =>
      xs.map((x) => x.getAttribute('href')),
    );
    const allowedAutumn = new Set(autumnTopics.map((t) => `/clipart/${t.slug}/`));
    assert.ok(autumnMatches.every((href) => allowedAutumn.has(href)));
    assert.equal(new Set(autumnMatches).size, autumnMatches.length);
    await page.locator('#topic-filter').fill('');
    while (await page.locator('#show-more-subjects').isVisible())
      await page.locator('#show-more-subjects').click();
    await expect(visibleTopics).toHaveCount(autumnTopics.length);
    assert.deepEqual(
      await visibleTopics.evaluateAll((xs) => xs.map((x) => x.getAttribute('href')).sort()),
      autumnTopics.map((t) => `/clipart/${t.slug}/`).sort(),
    );
  }
  await page.goto(base + '/collection/food-drink/');
  for (const t of expected)
    await expect(
      page.locator(`[aria-label="Topics in this collection"] a[href="/clipart/${t.slug}/"]`),
    ).toHaveCount(1);
  await page.goto(base + '/clipart/cranberry/');
  await expect(page.locator('.breadcrumb a[href="/collection/food-drink/"]')).toHaveCount(1);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    'https://ultraclipart.com/clipart/cranberry/',
  );
  await page.goto(base + '/categories/?collection=nature-elements');
  await expect(page.locator('#category-group')).toHaveValue('nature-elements');
  while (await page.locator('#show-more-subjects').isVisible())
    await page.locator('#show-more-subjects').click();
  for (const topic of ['fire', 'leaves'])
    await expect(
      page.locator(`[data-topic]:not([hidden]) a[href="/clipart/${topic}/"]`),
    ).toHaveCount(1);
  await page.goto(base + '/clipart/leaves/');
  await expect(page.locator('.breadcrumb a[href="/collection/nature-elements/"]')).toHaveCount(1);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    'https://ultraclipart.com/clipart/leaves/',
  );
  await page.goto(base + '/categories/?collection=school-learning');
  await expect(page.locator('#category-group')).toHaveValue('school-learning');
  while (await page.locator('#show-more-subjects').isVisible())
    await page.locator('#show-more-subjects').click();
  for (const topic of ['school', 'book'])
    await expect(
      page.locator(`[data-topic]:not([hidden]) a[href="/clipart/${topic}/"]`),
    ).toHaveCount(1);
  await page.goto(base + '/clipart/school/');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    'https://ultraclipart.com/clipart/school/',
  );
  await page.goto(base + '/clipart/book/');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    'https://ultraclipart.com/clipart/book/',
  );
  await page.goto(base + '/categories/?collection=sports');
  await expect(page.locator('#category-group')).toHaveValue('sports');
  while (await page.locator('#show-more-subjects').isVisible())
    await page.locator('#show-more-subjects').click();
  await expect(
    page.locator('[data-topic]:not([hidden]) a[href="/clipart/basketball/"]'),
  ).toHaveCount(1);
  await page.goto(base + '/clipart/basketball/');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    'https://ultraclipart.com/clipart/basketball/',
  );
  await page.goto(base + '/');
  const ids = await page
    .locator('.home-recent .gallery .art-card')
    .evaluateAll((xs) => xs.map((x) => x.dataset.id));
  assert.equal(ids.length, 15);
  assert.equal(new Set(ids.map((id) => art.find((x) => x.id === id).topic)).size, ids.length);
  assert.ok(ids.every((id) => art.some((item) => item.id === id)));
  assert.ok(ids.every((id) => !id.includes('astronaut')));
  report.checks = [
    'Food collection filter and collection page show all primary food topics without duplicate links',
    'Cranberry follows its primary Food category; seasonal associations do not duplicate primary browse groups',
    'Fire and Leaves are discoverable in Nature & elements; Leaves keeps one canonical topic URL',
    'School & learning exposes school and book collections with canonical category URLs',
    'Sports includes the repaired basketball collection with one canonical category URL',
    'Homepage introduces 15 different recently added subjects in complete desktop rows',
  ];
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} finally {
  await browser.close();
  fs.mkdirSync('reports/fruit-categories', { recursive: true });
  fs.writeFileSync('reports/fruit-categories/report.json', JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report));
