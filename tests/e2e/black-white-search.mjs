import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4323',
  engine = process.env.UC_BROWSER || 'chromium';
const browser = await { chromium, webkit }[engine].launch(),
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const report = { engine, queries: [], errors: [], status: 'running' };
page.on('pageerror', (e) => report.errors.push(e.message));
const ready = () =>
  expect(page.locator('#bw-results')).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
try {
  await page.goto(base + '/black-and-white/');
  await ready();
  await expect(page.locator('#bw-results .art-card')).toHaveCount(24);
  for (const query of ['sunflower', 'bunnies', 'elephant line drawing', 'sunflwer']) {
    await page.locator('#bw-query').fill(query);
    await page.locator('#bw-form button[type=submit]').click();
    await ready();
    await expect(page.locator('#bw-sort')).toHaveValue('relevance');
    assert.ok((await page.locator('#bw-results .art-card').count()) > 0, query);
    const ids = await page
      .locator('#bw-results .art-card')
      .evaluateAll((cards) => cards.map((c) => c.dataset.id));
    report.queries.push({ query, ids });
  }
  await page.locator('#bw-sort').selectOption('newest');
  await ready();
  await page.reload();
  await ready();
  await expect(page.locator('#bw-sort')).toHaveValue('newest');
  await page.locator('#bw-reset').click();
  await ready();
  await expect(page.locator('#bw-sort')).toHaveValue('newest');
  const first = await page.locator('#bw-results .art-card').first().getAttribute('data-id');
  await page.locator('#bw-next').click();
  await ready();
  assert.notEqual(
    await page.locator('#bw-results .art-card').first().getAttribute('data-id'),
    first,
  );
  await page.locator('#bw-query').fill('zzzz-impossible-subject');
  await page.locator('#bw-form button[type=submit]').click();
  await ready();
  await expect(page.locator('#bw-empty')).toBeVisible();
  await page.locator('#bw-show-all').click();
  await ready();
  await expect(page.locator('#bw-results .art-card')).toHaveCount(24);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
  );
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} finally {
  writeFileSync(
    `reports/categories-refresh/black-white-${engine}.json`,
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(
  JSON.stringify({
    engine,
    status: report.status,
    queries: report.queries.length,
    errors: report.errors,
  }),
);
