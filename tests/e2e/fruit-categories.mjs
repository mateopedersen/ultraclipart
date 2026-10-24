import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => JSON.parse(fs.readFileSync(p));
const art = read('data/art.json'),
  topics = [...read('data/topics.json').topics, ...read('data/extra-topics.json')];
const secondary = read('data/topic-clusters.json');
const expected = topics.filter(
  (t) =>
    [t.cluster, ...(secondary[t.slug] ?? [])].includes('Food & drink') &&
    art.some((a) => a.topic === t.slug),
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
    await page.locator('#category-group').selectOption('thanksgiving-autumn');
    await page.locator('#topic-filter').fill('cranberry');
    await expect(page.locator('[data-topic]:not([hidden]) a')).toHaveAttribute(
      'href',
      '/clipart/cranberry/',
    );
  }
  await page.goto(base + '/collection/food-drink/');
  for (const t of expected)
    await expect(page.locator(`.chips a[href="/clipart/${t.slug}/"]`)).toHaveCount(1);
  await page.goto(base + '/clipart/cranberry/');
  await expect(page.locator('.chips a[href="/collection/food-drink/"]')).toHaveCount(1);
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
  await expect(page.locator('.chips a[href="/collection/nature-elements/"]')).toHaveCount(1);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    'https://ultraclipart.com/clipart/leaves/',
  );
  await page.goto(base + '/categories/?collection=school-learning');
  await expect(page.locator('#category-group')).toHaveValue('school-learning');
  while (await page.locator('#show-more-subjects').isVisible())
    await page.locator('#show-more-subjects').click();
  await expect(page.locator('[data-topic]:not([hidden]) a[href="/clipart/school/"]')).toHaveCount(
    1,
  );
  await page.goto(base + '/clipart/school/');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    'https://ultraclipart.com/clipart/school/',
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
    .locator('.gallery .art-card')
    .evaluateAll((xs) => xs.map((x) => x.dataset.id));
  assert.equal(ids.length, 12);
  assert.equal(new Set(ids.map((id) => art.find((x) => x.id === id).topic)).size, 12);
  assert.ok(ids.every((id) => art.some((item) => item.id === id)));
  assert.ok(ids.every((id) => !id.includes('astronaut')));
  report.checks = [
    'Food dropdown shows all fruit topics without duplicate links',
    'Cranberry is discoverable from both Food and Autumn with one canonical topic URL',
    'Fire and Leaves are discoverable in Nature & elements; Leaves keeps one canonical topic URL',
    'School & learning exposes the repaired school collection with one canonical category URL',
    'Sports includes the repaired basketball collection with one canonical category URL',
    'Homepage introduces 12 different recently added subjects',
  ];
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} finally {
  await browser.close();
  fs.mkdirSync('reports/fruit-categories', { recursive: true });
  fs.writeFileSync('reports/fruit-categories/report.json', JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report));
