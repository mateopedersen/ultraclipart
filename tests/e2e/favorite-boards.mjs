import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, firefox, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const engine = process.env.UC_BROWSER || 'chromium',
  base = process.env.BASE_URL || 'http://127.0.0.1:4381';
const output = `reports/favorite-boards/${engine}`;
mkdirSync(output, { recursive: true });
const browser = await { chromium, firefox, webkit }[engine].launch();
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const report = { engine, checks: [], layouts: [], errors: [] };
page.on('pageerror', (e) => report.errors.push(e.message));
const source = 'apple-and-dried-rings-crayon-clipart',
  other = 'usb-flash-drive-artist-usb-drive-and-sketchbook-arrangement',
  fresh = 'winter-arctic-fox-resting';
async function ready() {
  await expect(page.locator('#favorites')).toHaveAttribute('aria-busy', 'false');
}
async function all() {
  await page.locator('[data-board="all"]').click();
  await ready();
}
async function create(title) {
  await page.locator('[data-board-create]').click();
  await page.locator('#board-form input[name=title]').fill(title);
  await page.locator('#board-form textarea').fill('A project with a personal name and a purpose.');
  await page.locator('#board-form select').selectOption('rose');
  await page.locator('#board-form button[type=submit]').click();
  await expect(page.locator('#board-dialog')).not.toBeVisible();
  await ready();
}
try {
  await page.goto(base + '/');
  await page.evaluate(
    ([a, b]) => localStorage.setItem('ultraclipart-favorites', JSON.stringify([a, b])),
    [source, other],
  );
  await page.goto(base + '/favorites/');
  await ready();
  await expect(page.locator('#favorites .art-card')).toHaveCount(2);
  await expect(page.locator('#favorites time')).toHaveCount(0);
  await create('For Olivia’s birthday');
  let state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('ultraclipart-favorite-boards-v1')),
  );
  const first = state.boards[0].id;
  await all();
  await page.locator(`[data-favorite-organize="${source}"]`).click();
  await page.locator(`#organize-board-options input[value="${first}"]`).check();
  await page.locator('#favorite-organize-form textarea').fill('A rainbow invitation for Olivia');
  await page.locator('#favorite-organize-form button[type=submit]').click();
  await ready();
  await create('Classroom projects');
  state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('ultraclipart-favorite-boards-v1')),
  );
  const second = state.boards.find((b) => b.id !== first).id;
  await all();
  await page.locator(`[data-favorite-organize="${source}"]`).click();
  await page.locator(`#organize-board-options input[value="${second}"]`).check();
  await page.locator('#favorite-organize-form button[type=submit]').click();
  await ready();
  await page.locator(`[data-board="${first}"]`).click();
  await ready();
  await expect(page.locator('#favorites .art-card')).toHaveCount(1);
  await expect(page.locator('.favorite-note')).toHaveText('A rainbow invitation for Olivia');
  await page.locator('[data-board-edit]').click();
  await page.locator('#board-form input[name=title]').fill('Olivia’s creative corner');
  await page.locator('#board-form button[type=submit]').click();
  await expect(page.locator('#current-board-title')).toHaveText('Olivia’s creative corner');
  await page.reload();
  await ready();
  await all();
  state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('ultraclipart-favorite-boards-v1')),
  );
  assert.deepEqual(state.entries[source].boards.sort(), [first, second].sort());
  assert.equal(state.entries[source].savedAt, undefined);
  report.checks.push(
    'Legacy dates stay unknown; named boards, descriptions, colors, multiple memberships, notes and renames persist',
  );
  const before = Date.now();
  await page.goto(`${base}/art/${fresh}/`);
  await page.locator('[data-favorite]').click();
  await expect(page.locator('[data-favorite]')).toHaveAttribute('aria-pressed', 'true');
  await page.goto(base + '/favorites/');
  await ready();
  const instant = await page.locator(`[data-id="${fresh}"] time`).getAttribute('datetime');
  assert.ok(Date.parse(instant) >= before && Date.parse(instant) <= Date.now());
  await page.locator('#favorites-date').selectOption('unknown');
  await ready();
  await expect(page.locator('#favorites .art-card')).toHaveCount(2);
  await page.locator('#favorites-date').selectOption('all');
  await ready();
  await page.locator('#favorites-search').fill('rainbow invitation');
  await ready();
  await expect(page.locator('#favorites .art-card')).toHaveCount(1);
  await page.locator('#favorites-search').fill('');
  await ready();
  await page.locator('#favorites-select').click();
  await ready();
  await page.locator(`[data-favorite-select="${other}"]`).click();
  await ready();
  await page.locator('#favorites-bulk-board').selectOption(first);
  await page.locator('#favorites-bulk-add').click();
  await ready();
  await page.locator(`[data-board="${first}"]`).click();
  await ready();
  await expect(page.locator('#favorites .art-card')).toHaveCount(2);
  await page.locator(`[data-favorite-select="${other}"]`).click();
  await ready();
  await page.locator('#favorites-bulk-remove').click();
  await ready();
  await expect(page.locator('#favorites .art-card')).toHaveCount(1);
  await all();
  await expect(page.locator('#favorites .art-card')).toHaveCount(3);
  await page.locator(`[data-favorite-select="${other}"]`).click();
  await ready();
  await page.locator('#favorites-bulk-delete').click();
  await ready();
  await expect(page.locator('#favorites .art-card')).toHaveCount(2);
  await page.locator('#boards-undo').click();
  await ready();
  await expect(page.locator('#favorites .art-card')).toHaveCount(3);
  report.checks.push(
    'Actual saved timestamp, note search, date filter, bulk assignment, remove-from-board, remove-favorite and undo',
  );
  const pending = page.waitForEvent('download');
  await page.locator('#boards-export').click();
  const backup = await pending;
  const contents = readFileSync(await backup.path());
  const data = JSON.parse(contents);
  assert.equal(data.application, 'ultraclipart-board-backup');
  assert.equal(data.favorites.length, 3);
  assert.equal(data.state.boards.length, 2);
  await page.locator(`[data-board="${first}"]`).click();
  await ready();
  await page.locator('[data-board-delete]').click();
  await ready();
  await expect(page.locator('#favorites .art-card')).toHaveCount(3);
  await page.locator('#boards-undo').click();
  await ready();
  await page
    .locator('#boards-import-file')
    .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: contents });
  await expect(page.locator('#boards-status')).toContainText('Backup imported');
  await ready();
  data.favorites.sort();
  assert.deepEqual(
    (await page.evaluate(() => JSON.parse(localStorage.getItem('ultraclipart-favorites')))).sort(),
    data.favorites,
  );
  await backup.delete();
  report.checks.push(
    'Backup export/import merges without duplicate favorites; board deletion preserves favorites and can be undone',
  );
  if ((await page.locator('#favorites-select').getAttribute('aria-pressed')) === 'true') {
    await page.locator('#favorites-select').click();
    await ready();
  }
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await all();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    const scan = await new AxeBuilder({ page })
      .setLegacyMode(engine === 'webkit')
      .include('.boards-hero')
      .include('.boards-library')
      .include('.boards-content')
      .include('.boards-backup')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    assert.deepEqual(
      scan.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
      [],
    );
    if ([1440, 390].includes(width))
      await page.screenshot({ path: `${output}/boards-${width}.png`, fullPage: false });
    report.layouts.push({ width, violations: 0 });
  }
  await page.locator('[data-board-create]').click();
  const dialogScan = await new AxeBuilder({ page })
    .setLegacyMode(engine === 'webkit')
    .include('#board-dialog')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  assert.deepEqual(dialogScan.violations, []);
  await page.keyboard.press('Escape');
  await expect(page.locator('#board-dialog')).not.toBeVisible();
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  console.log(JSON.stringify(report));
} finally {
  writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
