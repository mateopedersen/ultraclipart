import { chromium, webkit, firefox, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { inspectLayout } from '../helpers/layout-audit.mjs';

const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Local only');
const content = JSON.parse(readFileSync('data/trust-pages.json')).pages['editorial-process'];
const artwork = JSON.parse(readFileSync('data/art.json')).find(
  (a) => a.id === 'floral-heart-roses-wreath-clipart',
);
const output = process.env.EVIDENCE_DIR || 'reports/editorial-process/final';
mkdirSync(output, { recursive: true });
const report = {
  started: new Date().toISOString(),
  scope:
    'Local editorial page: two browser engines, eight widths, actual anchors, images, metadata and accessibility. No physical-device test.',
  states: [],
  checks: [],
  failures: [],
};
const engines = process.env.UC_BROWSER
  ? { [process.env.UC_BROWSER]: { chromium, webkit, firefox }[process.env.UC_BROWSER] }
  : { chromium, webkit };
for (const [engine, launcher] of Object.entries(engines)) {
  assert.ok(launcher, 'Supported browser engine required');
  const browser = await launcher.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    assert.equal((await page.goto(base + '/editorial-process/')).status(), 200);
    const consent = page.locator('[data-cookie-choice="necessary"]:visible').first();
    if (await consent.count()) await consent.click();
    await expect(page.locator('h1')).toHaveText(content.title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://ultraclipart.com/editorial-process/',
    );
    await expect(page.locator('body')).not.toHaveClass(/reader-page/);
    for (const section of content.sections)
      await expect(page.locator('#heading-' + section.id)).toHaveText(section.title);
    const image = page.locator('.ep-example-sheet > img');
    await expect(image).toHaveAttribute('alt', artwork.alt);
    await expect(image).toHaveAttribute('title', artwork.title);
    for (const img of await page.locator('.editorial-page img').all()) {
      await img.scrollIntoViewIfNeeded();
      await expect(img).toBeVisible();
      await img.evaluate((node) => node.decode());
    }
    const ids = await page.locator('[id]').evaluateAll((nodes) => nodes.map((node) => node.id));
    assert.equal(ids.length, new Set(ids).size, 'SVG/HTML IDs must be unique');
    for (const width of [320, 360, 390, 414, 600, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => scrollTo(0, 0));
      const layout = await page.evaluate(inspectLayout);
      assert.equal(layout.horizontalOverflow, false, `${engine}/${width} overflow`);
      assert.deepEqual(layout.clipped, [], `${engine}/${width} clipped text`);
      assert.deepEqual(layout.escaped, [], `${engine}/${width} escaped elements`);
      const geometry = await page.evaluate(() => {
        const rect = (node) => {
          const b = node.getBoundingClientRect();
          return {
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            right: b.right,
            bottom: b.bottom,
          };
        };
        const object = rect(document.querySelector('.ep-hero-object'));
        const title = rect(document.querySelector('.ep-example-sheet > a'));
        const overlap =
          Math.min(object.right, title.right) > Math.max(object.x, title.x) &&
          Math.min(object.bottom, title.bottom) > Math.max(object.y, title.y);
        return {
          decorativeTitleOverlap: overlap,
          workflowHeights: [...document.querySelectorAll('.ep-workflow a')].map(
            (node) => node.getBoundingClientRect().height,
          ),
          relatedHeights: [...document.querySelectorAll('.ep-related > a')].map(
            (node) => node.getBoundingClientRect().height,
          ),
        };
      });
      assert.equal(
        geometry.decorativeTitleOverlap,
        false,
        `${engine}/${width} artwork title must remain uncovered`,
      );
      for (const heights of [geometry.workflowHeights, geometry.relatedHeights])
        assert.ok(
          Math.max(...heights) - Math.min(...heights) < 2,
          `${engine}/${width} equal-height links`,
        );
      const scan = await new AxeBuilder({ page })
        .include('.editorial-page')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      assert.deepEqual(
        scan.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        [],
        `${engine}/${width} accessibility`,
      );
      if ([320, 390, 768, 1440].includes(width))
        await page.screenshot({ path: `${output}/${engine}-${width}.png`, fullPage: true });
      report.states.push({ engine, width, passed: true, ...geometry, accessibilityViolations: 0 });
    }
    for (const anchor of await page.locator('.ep-workflow a, .ep-actions a[href^="#"]').all()) {
      const href = await anchor.getAttribute('href');
      await anchor.click();
      await expect(page).toHaveURL(base + '/editorial-process/' + href);
      assert.ok(await page.locator(href).isVisible());
    }
    const targets = await page
      .locator('.editorial-page a[href^="/"]')
      .evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute('href')))]);
    for (const href of targets) {
      const response = await page.request.get(base + href);
      assert.equal(response.status(), 200, href);
      const hash = new URL(href, base).hash;
      if (hash) assert.ok((await response.text()).includes(`id="${hash.slice(1)}"`));
    }
    const mail = new URL(await page.locator('.ep-report-guide .ep-button').getAttribute('href'));
    assert.equal(mail.protocol, 'mailto:');
    assert.equal(mail.pathname, 'ultraclipart@gmail.com');
    await page.locator('[data-editorial-example]').click();
    await expect(page).toHaveURL(base + '/art/' + artwork.id + '/');
    assert.deepEqual(errors, []);
    report.checks.push({
      engine,
      passed: true,
      anchors: 7,
      internalTargets: targets.length,
      exampleNavigation: true,
      savedMetadata: true,
      emailPreparedOnly: true,
    });
    const nojs = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    try {
      const plain = await nojs.newPage();
      await plain.goto(base + '/editorial-process/');
      await expect(plain.locator('.ep-stage')).toHaveCount(6);
      await plain.locator('.ep-workflow a[href="#files"]').click();
      await expect(plain).toHaveURL(base + '/editorial-process/#files');
      report.checks.push({ engine, passed: true, noJavaScriptReadingAndNavigation: true });
    } finally {
      await nojs.close();
    }
  } catch (error) {
    report.failures.push({ engine, error: error.stack, pageErrors: errors });
    await page
      .screenshot({ path: `${output}/${engine}-failure.png`, fullPage: true })
      .catch(() => {});
  } finally {
    await context.close();
    await browser.close();
  }
}
report.finished = new Date().toISOString();
writeFileSync(output + '/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
assert.deepEqual(report.failures, []);
