import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { inspectLayout } from '../helpers/layout-audit.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4323';
const engine = process.env.UC_BROWSER || 'chromium';
const out = process.env.EVIDENCE_DIR || `reports/favorites-workspace/${engine}`;
mkdirSync(out, { recursive: true });
const art = JSON.parse(readFileSync(new URL('../../data/art.json', import.meta.url), 'utf8'))
  .filter((a) => a.published && a.indexable)
  .slice(0, 20);
const ids = art.map((a) => a.id),
  now = '2026-10-27T09:00:00.000Z';
const board = (id, title) => ({
  id,
  title,
  description: 'Project ideas',
  color: 'blue',
  createdAt: now,
  updatedAt: now,
});
const initial = {
  schema: 1,
  boards: [board('board-a', 'Birthday'), board('board-b', 'Classroom'), board('board-c', 'Travel')],
  entries: Object.fromEntries(
    art.map((a, i) => [
      a.id,
      {
        title: a.title,
        thumb: a.thumb,
        note: i === 0 ? '=SUM(1,2)' : i === 1 ? 'summer invitation' : '',
        boards: i < 10 ? ['board-a'] : ['board-b'],
        savedAt: now,
        tags: i === 1 ? ['summer'] : [],
        stage: i === 2 ? 'ready' : 'idea',
        pinned: i === 0,
      },
    ]),
  ),
};
const browser = await { chromium, webkit }[engine].launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
await context.addInitScript(
  ({ ids, initial }) => {
    if (!localStorage.getItem('test-favorites-seeded')) {
      localStorage.setItem('ultraclipart-favorites', JSON.stringify(ids));
      localStorage.setItem('ultraclipart-favorite-boards-v1', JSON.stringify(initial));
      localStorage.setItem('test-favorites-seeded', '1');
    }
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(Error('test fallback')) },
    });
  },
  { ids, initial },
);
const page = await context.newPage();
const report = { engine, base, checks: [], errors: [], status: 'running' };
page.on('pageerror', (e) => report.errors.push(e.message));
const state = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('ultraclipart-favorite-boards-v1')));
const gallery = () => page.locator('#favorites .art-card');
const wait = () =>
  expect(page.locator('#favorites')).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
const check = (name) => report.checks.push(name);
try {
  await page.goto(base + '/favorites/');
  const cookie = page.locator('[data-cookie-choice=necessary]:visible');
  if (await cookie.count()) await cookie.first().tap();
  await wait();
  await expect(gallery()).toHaveCount(8);
  await expect(page.locator('#stat-all')).toHaveText('20');
  check('Collection overview counts');
  await page.locator('[data-smart-view=pinned]').tap();
  await wait();
  await expect(gallery()).toHaveCount(1);
  check('Pinned smart view');
  await page.locator('#favorites-reset').tap();
  await wait();
  const pinId = await gallery()
    .first()
    .locator('[data-favorite-pin]')
    .getAttribute('data-favorite-pin');
  const wasPinned = !!(await state()).entries[pinId].pinned;
  await gallery().first().locator('[data-favorite-pin]').tap();
  await wait();
  assert.equal(!!(await state()).entries[pinId].pinned, !wasPinned);
  check('Pin and unpin a design');
  await page.locator('#favorites-search').fill('invitation summer');
  await wait();
  await expect(gallery()).toHaveCount(1);
  check('Multiword note search');
  await page.locator('#favorites-search').fill('"summer invitation" -winter');
  await wait();
  await expect(gallery()).toHaveCount(1);
  check('Quoted phrases and excluded words');
  await page.locator('#favorites-search').fill('');
  await page.locator('#favorites-stage').selectOption('ready');
  await wait();
  await expect(gallery()).toHaveCount(1);
  check('Project stage filter');
  await page.locator('#favorites-reset').tap();
  await page.locator('#favorites-tag').selectOption('summer');
  await wait();
  await expect(gallery()).toHaveCount(1);
  check('Tag filter');
  await page.locator('#favorites-reset').tap();
  await page.locator('#favorites-noted').check();
  await wait();
  await expect(gallery()).toHaveCount(2);
  check('Notes-only filter');
  await page.locator('#favorites-reset').tap();
  await page.locator('#board-search').fill('Classroom');
  await expect(page.locator('[data-board=board-a]')).toHaveCount(0);
  await expect(page.locator('[data-board=board-b]')).toHaveCount(1);
  check('Board search');
  await page.locator('#board-search').fill('');
  await page.locator('#board-sort').selectOption('title');
  check('Board sorting');
  await page.locator('[data-board=board-a]').tap();
  await wait();
  await page.locator('[data-board-pin]').tap();
  assert.equal((await state()).boards.find((b) => b.id === 'board-a').pinned, true);
  check('Pinned boards');
  await page.locator('[data-board-duplicate]').tap();
  await wait();
  const copy = (await state()).boards.find((b) => b.title === 'Birthday (copy)');
  assert.ok(copy);
  assert.equal(
    Object.values((await state()).entries).filter((e) => e.boards.includes(copy.id)).length,
    10,
  );
  check('Duplicate board and its memberships');
  await page.locator('[data-board-archive]').tap();
  await wait();
  assert.equal((await state()).boards.find((b) => b.id === copy.id).archived, true);
  await expect(page.locator(`[data-board="${copy.id}"]`)).toHaveCount(0);
  check('Archive without deleting designs');
  await page.locator('#board-archived').check();
  await page.locator(`[data-board="${copy.id}"]`).tap();
  await page.locator('[data-board-archive]').tap();
  await wait();
  assert.equal(!!(await state()).boards.find((b) => b.id === copy.id).archived, false);
  check('Show and restore archived boards');
  await gallery().first().locator('[data-favorite-organize]').tap();
  await page.locator('#favorite-set-cover').tap();
  assert.ok((await state()).boards.find((b) => b.id === copy.id).coverId);
  check('Choose board cover');
  await page.locator('[data-board=all]').tap();
  await wait();
  await page.locator('#favorites-select').tap();
  await wait();
  await page.locator('#favorites-select-page').tap();
  await wait();
  await expect(page.locator('#favorites-selected-count')).toHaveText('8 selected');
  check('Select current page');
  await page.locator('#favorites-invert').tap();
  await wait();
  await expect(page.locator('#favorites-selected-count')).toHaveText('0 selected');
  check('Invert page selection');
  await page.locator('#favorites-select-all').tap();
  await wait();
  await expect(page.locator('#favorites-selected-count')).toHaveText('20 selected');
  check('Select all filtered matches across pages');
  await page.locator('#favorites-bulk-stage').selectOption('shortlist');
  await page.locator('#favorites-apply-stage').tap();
  await wait();
  assert.ok(Object.values((await state()).entries).every((e) => e.stage === 'shortlist'));
  check('Bulk stage changes');
  await page.locator('#favorites-bulk-tags').fill('project, summer');
  await page.locator('#favorites-apply-tags').tap();
  await wait();
  assert.ok(Object.values((await state()).entries).every((e) => e.tags.includes('project')));
  check('Bulk tags preserve existing tags');
  await page.locator('#favorites-clear-selection').tap();
  await wait();
  await expect(page.locator('#favorites-selected-count')).toHaveText('0 selected');
  check('Clear selection');
  await page.locator('[data-board=board-a]').tap();
  await wait();
  const movingId = await gallery()
    .first()
    .locator('[data-favorite-select]')
    .getAttribute('data-favorite-select');
  await page.locator('#favorites-select-page').tap();
  await wait();
  await page.locator('#favorites-bulk-board').selectOption('board-b');
  await page.locator('#favorites-bulk-move').tap();
  await wait();
  assert.ok((await state()).entries[movingId].boards.includes('board-b'));
  assert.ok(!(await state()).entries[movingId].boards.includes('board-a'));
  assert.ok((await state()).entries[movingId].boards.includes(copy.id));
  check('Move designs while preserving other board memberships');
  await page.locator('[data-board=all]').tap();
  await wait();
  await page.locator('#favorites-copy-links').tap();
  await expect(page.locator('#favorites-links-dialog')).toBeVisible();
  assert.equal((await page.locator('#favorites-links-text').inputValue()).split('\n').length, 20);
  await page.locator('#favorites-links-dialog [data-dialog-close]').first().tap();
  check('Copy links with manual clipboard fallback');
  const csvPromise = page.waitForEvent('download');
  await page.locator('#favorites-csv').tap();
  const csv = await csvPromise;
  const stream = await csv.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const data = Buffer.concat(chunks).toString('utf8');
  assert.ok(data.includes("'=SUM(1,2)"));
  assert.ok(data.includes('https://ultraclipart.com/art/'));
  check('CSV export with inert spreadsheet formulas');
  const popupPromise = context.waitForEvent('page');
  await page.locator('#favorites-print').tap();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  await expect(popup.locator('article')).toHaveCount(8);
  await expect(popup.locator('#print-sheet')).toBeVisible();
  await popup.close();
  check('Private printable planning sheet');
  await page.locator('#favorites-page-size').selectOption('16');
  await page.locator('#favorites-density').selectOption('compact');
  await page.locator('#favorites-show-notes').uncheck();
  await wait();
  await expect(gallery()).toHaveCount(16);
  await expect(page.locator('#favorites')).toHaveAttribute('data-density', 'compact');
  await expect(page.locator('#favorites')).toHaveClass(/hide-favorite-notes/);
  await page.reload();
  await wait();
  await expect(page.locator('#favorites-page-size')).toHaveValue('16');
  check('Persistent page size, compact layout and note visibility');
  await page.locator('#favorites-last').tap();
  await wait();
  await expect(gallery()).toHaveCount(4);
  await page.locator('#favorites-first').tap();
  await wait();
  await expect(gallery()).toHaveCount(16);
  check('First and last page navigation');
  await page.locator('#favorites-sort').selectOption('title-desc');
  await wait();
  check('Reverse alphabetical sorting');
  await page.locator('#favorites-sort').selectOption('updated');
  await wait();
  check('Recently organized sorting');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const l = await page.evaluate(inspectLayout);
    writeFileSync(`${out}/layout-${width}.json`, JSON.stringify(l, null, 2));
    await page.screenshot({ path: `${out}/layout-${width}.png`, fullPage: true });
    assert.equal(l.horizontalOverflow, false);
    assert.deepEqual(l.clipped, []);
    await page.screenshot({ path: `${out}/favorites-${width}.png`, fullPage: true });
  }
  check('Responsive layouts at four widths');

  await page.setViewportSize({ width: 320, height: 700 });
  if (!(await page.locator('#favorites-refine').evaluate((el) => el.open)))
    await page.locator('#favorites-refine summary').tap();
  await page.locator('#favorites-select').tap();
  await wait();
  const openLayout = await page.evaluate(inspectLayout);
  assert.equal(openLayout.horizontalOverflow, false);
  assert.deepEqual(openLayout.clipped, []);
  const axe = await new AxeBuilder({ page })
    .setLegacyMode(engine === 'webkit')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  assert.deepEqual(
    axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
  );
  await page.locator('.boards-library').screenshot({ path: `${out}/boards-mobile.png` });
  await page.locator('#favorites-refine').screenshot({ path: `${out}/refine-mobile.png` });
  await page.locator('#favorites-bulk').screenshot({ path: `${out}/bulk-mobile.png` });
  check('Open mobile filters and bulk toolbar: layout and accessibility');
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (e) {
  report.status = 'failed';
  report.failure = String(e);
  throw e;
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report));
