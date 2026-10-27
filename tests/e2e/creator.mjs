import { chromium, webkit, firefox, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const engine = process.env.UC_BROWSER || 'chromium';
const base = process.env.UC_BASE_URL || 'http://127.0.0.1:4333';
const out = path.resolve(process.env.UC_EVIDENCE_DIR || 'work/creator-evidence', engine);
await fs.mkdir(out, { recursive: true });
const browser = await { chromium, webkit, firefox }[engine].launch({
  headless: true,
  ...(process.env.UC_BROWSER_PATH ? { executablePath: process.env.UC_BROWSER_PATH } : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  acceptDownloads: true,
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors = [],
  violations = [],
  checks = [],
  exports = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) =>
    window.__csp.push({ directive: e.violatedDirective, blocked: e.blockedURI }),
  );
});
const action = (name) => page.locator(`[data-action="${name}"]`).filter({ visible: true }).first();
const panel = async (name) => page.locator(`[data-panel="${name}"]`).click();
const state = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('ultraclipart:editor:v1:my-clipart')));
const change = async (selector, value) => {
  await page.locator(selector).fill(String(value));
  await page.locator(selector).press('Tab');
};
const saved = async (name) => {
  const p = page.waitForEvent('download');
  await action('save').click();
  const d = await p;
  const file = path.join(out, name);
  await d.saveAs(file);
  return file;
};
const exporting = async (format, name) => {
  await action('export').click();
  await page.locator(`[data-format][value="${format}"]`).locator('..').click();
  await expect(page.locator(`[data-format][value="${format}"]`)).toBeChecked();
  const p = page.waitForEvent('download', { timeout: 30000 });
  await action('download').click();
  const d = await p;
  const file = path.join(out, name);
  await d.saveAs(file);
  const bytes = (await fs.stat(file)).size;
  expect(bytes).toBeGreaterThan(100);
  if (format === 'pdf') expect(bytes).toBeLessThanOrEqual(1000000);
  exports.push({ name, format, bytes });
  await action('close-export').click();
};
const draw = async (cancel = false) => {
  await page.locator('.uc-canvas').scrollIntoViewIfNeeded();
  const box = await page.locator('[data-artwork-canvas]').boundingBox();
  const x = box.x + box.width * 0.15,
    y = box.y + box.height * 0.3;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++)
    await page.mouse.move(x + box.width * 0.04 * i, y + Math.sin(i * 0.55) * box.height * 0.15);
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
};
try {
  await page.goto(`${base}/create/`);
  await expect(page.locator('[data-status]')).toContainText('blank canvas is ready');
  await expect(page.locator('button[data-work-mode=edit]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('[data-empty-canvas]')).toBeVisible();
  await expect(page.locator('.uc-editor [inert]')).toHaveCount(0);
  checks.push('blank first-class canvas, one H1, ready controls');
  await panel('create');
  for (const kind of [
    'rectangle',
    'rounded',
    'ellipse',
    'star',
    'polygon',
    'line',
    'bubble',
    'heart',
  ])
    await page.locator(`[data-shape="${kind}"]`).click();
  expect((await state()).layers.length).toBe(8);
  expect(new Set((await state()).layers.map((l) => l.markup)).size).toBe(8);
  await expect(page.locator('[data-empty-canvas]')).toBeHidden();
  checks.push('eight distinct parametric editable shapes');
  await page.locator('[data-create-fill]').fill('#e69060');
  await page.locator('[data-create-stroke]').fill('#264a40');
  await change('[data-create-width]', 7);
  await action('paint-selection').click();
  expect((await state()).layers.at(-1).markup).toContain('#e69060');
  const painted = JSON.stringify(await state());
  await action('undo').click();
  expect(JSON.stringify(await state())).not.toBe(painted);
  await action('redo').click();
  expect(JSON.stringify(await state())).toBe(painted);
  checks.push('selected vector fill/stroke and exact undo/redo');
  await panel('canvas');
  await change('[data-canvas-width]', 900);
  await change('[data-canvas-height]', 700);
  await action('resize-canvas').click();
  expect((await state()).width).toBe(900);
  expect((await state()).height).toBe(700);
  expect((await state()).layers.length).toBe(8);
  await panel('create');
  await action('draw').click();
  await draw();
  expect((await state()).layers.length).toBe(9);
  expect((await state()).layers.at(-1).markup).toContain(' C');
  expect((await state()).layers.at(-1).markup).toContain('fill="none"');
  const completed = JSON.stringify(await state());
  await draw(true);
  expect(JSON.stringify(await state())).toBe(completed);
  await expect(action('draw')).toHaveAttribute('aria-pressed', 'false');
  checks.push('smooth cubic freehand stroke; Escape cancels without history mutation');
  await action('draw').click();
  const box = await page.locator('[data-artwork-canvas]').boundingBox();
  await page.mouse.move(box.x + 60, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 120);
  await page.locator('.uc-stage').dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  expect(JSON.stringify(await state())).toBe(completed);
  await action('draw').click();
  checks.push('pointer interruption cancels unfinished stroke');
  await panel('text');
  await change('[data-text]', 'Made by me');
  await action('text').click();
  expect((await state()).layers.at(-1).kind).toBe('text');
  await panel('transform');
  await action('select-all').click();
  await panel('layers');
  await action('group').click();
  expect(new Set((await state()).layers.map((l) => l.group)).size).toBe(1);
  await action('ungroup').click();
  expect((await state()).layers.every((l) => !l.group)).toBe(true);
  const project = await saved('created-project.json');
  let exact = JSON.stringify(await state());
  await page.reload();
  await expect(page.locator('[data-status]')).toContainText('restored');
  expect(JSON.stringify(await state())).toBe(exact);
  await panel('canvas');
  await action('blank').click();
  expect((await state()).layers.length).toBe(0);
  await page.locator('[data-load]').setInputFiles(project);
  await expect(page.locator('[data-status]')).toContainText('Saved project opened');
  expect(JSON.stringify(await state())).toBe(exact);
  checks.push('text, linked groups, local recovery, project save/open exact roundtrip');
  await exporting('webp', 'created-art.webp');
  await exporting('pdf', 'created-art.pdf');
  exact = JSON.stringify(await state());
  await page.screenshot({ path: path.join(out, 'created-desktop.png'), fullPage: true });
  // A real imported SVG uses root inheritance, translated viewBox and a root transform.
  const safe =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 640 480" fill="#dd8855" fill-opacity="0.7" transform="translate(3 4)"><g data-label="Imported leaf"><path d="M30 40 Q150 30 210 180 Q60 190 30 40Z"/></g><circle cx="350" cy="220" r="70" fill="#b7cba5"/></svg>';
  await page
    .locator('[data-import-svg]')
    .setInputFiles({ name: 'safe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(safe) });
  await expect(page.locator('[data-status]')).toContainText('2 editable SVG layers imported');
  let imported = await state();
  expect(imported.width).toBe(640);
  expect(imported.layers[0].label).toBe('Imported leaf');
  expect(imported.layers[0].markup).toContain('fill-opacity="0.7"');
  expect(imported.layers[0].markup).toContain('translate(3 4)');
  await exporting('webp', 'imported.webp');
  await exporting('pdf', 'imported.pdf');
  imported = await state();
  checks.push('safe import keeps layers, canvas, viewBox origin, root transform and paint opacity');
  const malicious = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" onload="alert(1)"><rect width="50" height="50"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><image href="https://bad.example/x"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect width="500" height="500" fill="url(https://bad.example)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><path d="M0 0 A20 20 0 0 1 100 100"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 99999 99999"><rect width="50" height="50"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect width="Infinity" height="50"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><g opacity="0.5"><rect width="50" height="50"/></g></svg>',
  ];
  for (const [i, svg] of malicious.entries()) {
    await page.locator('[data-import-svg]').setInputFiles({
      name: `unsafe-${i}.svg`,
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(svg),
    });
    await expect(page.locator('[data-status]')).toHaveAttribute('data-error', 'true');
    expect(await state()).toEqual(imported);
  }
  checks.push('eight unsafe, unsupported or unbounded SVG inputs rejected without changing work');
  await action('undo').click();
  expect(JSON.stringify(await state())).toBe(exact);
  checks.push('import replacement remains undoable');
  await page.locator('.studio-basic-starters').evaluate((el) => (el.open = true));
  for (const [id, count] of [
    ['sunny-badge', 20],
    ['botanical-sprig', 12],
    ['school-label', 12],
    ['party-spark', 14],
    ['rainbow-arch', 10],
    ['little-postcard', 11],
  ]) {
    await page.locator(`[data-creator-template="${id}"]`).click();
    await expect(page.locator('[data-status]')).toContainText(
      `${count} editable starter layers loaded`,
    );
    expect((await state()).layers.length).toBe(count);
    expect((await state()).width).toBe(800);
    expect((await state()).height).toBe(600);
    await exporting('webp', `${id}.webp`);
    await exporting('pdf', `${id}.pdf`);
  }
  checks.push('six independent starter compositions load and export both formats');
  // A late starter must not replace a newer selection.
  await page.route('**/studio/sunny-badge.svg', async (route) => {
    await new Promise((r) => setTimeout(r, 700));
    await route.continue().catch(() => {});
  });
  await page.locator('[data-creator-template="sunny-badge"]').click();
  await page.locator('[data-creator-template="rainbow-arch"]').click();
  await expect(page.locator('[data-status]')).toContainText('10 editable starter layers loaded');
  await page.waitForTimeout(800);
  expect((await state()).layers.length).toBe(10);
  await page.unroute('**/studio/sunny-badge.svg');
  checks.push('stale asynchronous starter response cannot replace latest selection');
  for (const actionName of ['reset', 'undo', 'new-shape']) {
    await page.route('**/studio/sunny-badge.svg', async (route) => {
      await new Promise((r) => setTimeout(r, 700));
      await route.continue().catch(() => {});
    });
    await page.locator('[data-creator-template="sunny-badge"]').click();
    if (actionName === 'new-shape') {
      await panel('create');
      await page.locator('[data-shape="heart"]').click();
    } else await action(actionName).click();
    const chosen = await state();
    await page.waitForTimeout(850);
    expect(await state()).toEqual(chosen);
    await page.unroute('**/studio/sunny-badge.svg');
  }
  checks.push('late starter cannot overwrite Reset, Undo or a newly drawn shape');
  await panel('canvas');
  const beforeRejected = await state();
  const unsafeProjects = [
    { ...beforeRejected, crop: { x: 0, y: 0, width: 1e-308, height: 1e308 } },
    {
      ...beforeRejected,
      layers: [
        {
          ...beforeRejected.layers[0],
          id: 'bad',
          kind: 'vector',
          markup: '<rect width="1e100" height="10"/>',
        },
      ],
    },
    {
      ...beforeRejected,
      layers: [
        {
          ...beforeRejected.layers[0],
          id: 'bad',
          kind: 'vector',
          markup:
            '<g transform="scale(10000)">'.repeat(12) +
            '<rect width="1" height="1"/>' +
            '</g>'.repeat(12),
        },
      ],
    },
    {
      ...beforeRejected,
      layers: [0, 1].map((i) => ({
        ...beforeRejected.layers[0],
        id: `big-${i}`,
        kind: 'vector',
        markup: '<circle cx="10" cy="10" r="1"/>'.repeat(6000),
      })),
    },
  ];
  for (const [i, value] of unsafeProjects.entries()) {
    await page.locator('[data-load]').setInputFiles({
      name: `unsafe-project-${i}.json`,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(value)),
    });
    await expect(page.locator('[data-status]')).toHaveAttribute('data-error', 'true');
    expect(await state()).toEqual(beforeRejected);
  }
  checks.push(
    'project rejects degenerate crop, oversized scalar/composed transform and aggregate element budget',
  );
  // A pending export from a closed dialog must never download into a new session.
  await page.reload();
  await expect(page.locator('[data-status]')).toContainText('restored');
  await page.route('**/color/print.icc', async (route) => {
    await new Promise((r) => setTimeout(r, 900));
    await route.continue();
  });
  let unexpectedDownloads = 0;
  const watch = () => unexpectedDownloads++;
  page.on('download', watch);
  await action('export').click();
  await page.locator('[data-format][value="pdf"]').locator('..').click();
  const resource = page.waitForRequest('**/color/print.icc');
  await action('download').click();
  await resource;
  await action('close-export').click();
  await panel('create');
  await page.locator('[data-shape="star"]').click();
  await action('export').click();
  await page.waitForTimeout(1500);
  expect(unexpectedDownloads).toBe(0);
  await expect(page.locator('[data-export-status]')).toBeEmpty();
  page.off('download', watch);
  await page.unroute('**/color/print.icc');
  await action('close-export').click();
  checks.push('closed export session cannot download or write status into a newly opened dialog');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await panel('create');
    await page.screenshot({ path: path.join(out, `studio-${width}.png`), fullPage: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    expect(overflow).toBe(false);
    const audit = await new AxeBuilder({ page }).exclude('astro-dev-toolbar').analyze();
    violations.push(...audit.violations);
    expect(audit.violations).toEqual([]);
  }
  checks.push('desktop/tablet/390px/320px: no document overflow or axe violations');
  const csp = await page.evaluate(() => window.__csp);
  expect(csp).toEqual([]);
  expect(errors).toEqual([]);
  await fs.writeFile(
    path.join(out, 'report.json'),
    JSON.stringify(
      { engine, base, checks, exports, errors, csp, axeViolations: violations.length },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      engine,
      checks: checks.length,
      exports: exports.length,
      errors,
      csp,
      axeViolations: violations.length,
    }),
  );
} catch (e) {
  await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(
    path.join(out, 'failure.json'),
    JSON.stringify(
      {
        message: String(e),
        checks,
        errors,
        status: await page
          .locator('[data-status]')
          .textContent()
          .catch(() => null),
      },
      null,
      2,
    ),
  );
  throw e;
} finally {
  await browser.close();
}
