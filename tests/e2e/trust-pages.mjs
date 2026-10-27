import { chromium, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const content = JSON.parse(readFileSync(new URL('../../data/trust-pages.json', import.meta.url)));
const base = process.env.BASE_URL || 'http://127.0.0.1:4323';
const engine = process.env.UC_BROWSER || 'chromium';
const evidence = `reports/trust-pages/${engine}`;
mkdirSync(evidence, { recursive: true });
const browser = await { chromium, webkit }[engine].launch();
const errors = [];
const report = { base, engine, pages: [], checks: [], errors };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base + '/privacy/', { waitUntil: 'networkidle' });
  const necessary = page.locator('[data-cookie-choice="necessary"]:visible').first();
  if (await necessary.count()) await necessary.click();
  for (const [slug, entry] of Object.entries(content.pages)) {
    const response = await page.goto(base + '/' + slug + '/', { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200, slug);
    await expect(page.locator('h1')).toHaveText(entry.title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://ultraclipart.com/${slug}/`,
    );
    await expect(page.locator('.trust-section')).toHaveCount(entry.sections.length);
    assert.equal(await page.locator('body.reader-page').count(), 0, 'original site font scope');
    const ids = await page.locator('[id]').evaluateAll((nodes) => nodes.map((n) => n.id));
    assert.equal(new Set(ids).size, ids.length, slug + ' unique IDs');
    for (const section of entry.sections) {
      const heading = page.locator('#heading-' + section.id);
      await expect(heading).toHaveText(section.title);
      for (const link of section.links || [])
        if (link.href.startsWith('/')) {
          const u = new URL(link.href, base);
          if (content.pages[u.pathname.split('/')[1]] && u.hash) {
            const target = content.pages[u.pathname.split('/')[1]];
            assert.ok(
              target.sections.some((s) => s.id === u.hash.slice(1)),
              link.href,
            );
          }
        }
    }
    const widths = engine === 'webkit' ? [390, 320] : [1440, 1024, 768, 390, 320];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${slug} overflow at ${width}`,
      );
      const bounds = await page
        .locator(
          '.trust-hero, .trust-reading, .trust-table-wrap, .trust-report-builder:visible, .trust-related',
        )
        .evaluateAll((nodes) =>
          nodes.map((n) => ({
            cls: n.className,
            left: n.getBoundingClientRect().left,
            right: n.getBoundingClientRect().right,
            width: innerWidth,
          })),
        );
      assert.ok(
        bounds.every((x) => x.left >= -1 && x.right <= x.width + 1),
        JSON.stringify({ slug, width, bounds }),
      );
    }
    await page.setViewportSize({ width: engine === 'webkit' ? 390 : 1440, height: 1000 });
    const scan = await new AxeBuilder({ page })
      .include('.trust-page')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    assert.deepEqual(
      scan.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
      slug + ' accessibility',
    );
    await page.locator('.trust-hero').screenshot({ path: `${evidence}/${slug}-hero.png` });
    // A reproduced WebKit gradient-compositing fault painted bright yellow
    // noise over the blue/silver artwork. Keep that visible defect covered.
    // Check the blue/silver vector itself. Catalog artwork in a hero can
    // legitimately contain yellow and must not be mistaken for SVG corruption.
    const vector = await page
      .locator('.trust-hero .trust-illustration, .trust-hero [data-editorial-illustration]')
      .first()
      .screenshot();
    const { data: pixels } = await sharp(vector)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let corruptedPixels = 0;
    for (let i = 0; i < pixels.length; i += 3)
      if (pixels[i] > 180 && pixels[i + 1] > 130 && pixels[i + 2] < 100) corruptedPixels++;
    assert.equal(
      corruptedPixels,
      0,
      slug + ' hero gradient must not produce yellow raster artifacts',
    );
    await page.screenshot({ path: `${evidence}/${slug}.png` });
    report.pages.push({
      slug,
      status: 200,
      widths,
      sections: entry.sections.length,
      accessibilityViolations: 0,
    });
  }
  report.checks.push(
    'seven pages: headings, canonical URLs, section links, unique IDs, widths and automated accessibility',
  );
  await page.goto(base + '/faq/', { waitUntil: 'networkidle' });
  const count = content.pages.faq.sections.reduce((n, s) => n + (s.questions?.length || 0), 0);
  await expect(page.locator('[data-faq-question]')).toHaveCount(count);
  await page.locator('#trust-faq-search').fill('commercial');
  await expect(page.locator('[data-faq-status]')).toContainText('match your search');
  assert.ok((await page.locator('[data-faq-question]:visible').count()) > 0);
  assert.ok((await page.locator('[data-faq-question]:visible').count()) < count);
  await page.locator('[data-faq-collapse]').click();
  await expect(page.locator('[data-faq-question]:visible[open]')).toHaveCount(0);
  await page.locator('[data-faq-expand]').click();
  assert.equal(
    await page.locator('[data-faq-question]:visible[open]').count(),
    await page.locator('[data-faq-question]:visible').count(),
  );
  await page.locator('#trust-faq-search').fill('zzzznotananswer');
  await expect(page.locator('[data-faq-empty]')).toBeVisible();
  await page.locator('[data-faq-clear]').click();
  await expect(page.locator('[data-faq-question]:visible')).toHaveCount(count);
  const first = page.locator('[data-faq-question] summary').first();
  await first.focus();
  const wasOpen = await first.evaluate((n) => n.parentElement.open);
  await page.keyboard.press('Enter');
  assert.notEqual(await first.evaluate((n) => n.parentElement.open), wasOpen);
  report.checks.push(
    'FAQ filters answer text, handles empty results, clears, expands/collapses and supports keyboard activation',
  );
  await page.goto(base + '/copyright/', { waitUntil: 'networkidle' });
  const network = [];
  const track = (req) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method())) network.push(req.url());
  };
  page.on('request', track);
  await page.fill('#rights-url', 'https://ultraclipart.com/art/example/');
  await page.selectOption('#rights-kind', { label: 'Privacy or likeness' });
  await page.fill(
    '#rights-detail',
    'Please review this title. <script>keep this literal</script> & do not send it automatically.',
  );
  const draft = await page.locator('#rights-draft').inputValue();
  assert.ok(draft.includes('<script>keep this literal</script>'));
  const mail = new URL(await page.locator('[data-rights-email]').getAttribute('href'));
  assert.equal(mail.protocol, 'mailto:');
  assert.equal(mail.pathname, 'ultraclipart@gmail.com');
  assert.equal(mail.searchParams.get('body'), draft);
  assert.equal(mail.searchParams.get('subject'), 'Privacy or likeness report');
  assert.deepEqual(network, []);
  page.off('request', track);
  report.checks.push(
    'rights report remains local, safely encodes literal input, and prepares email without sending',
  );
  await page.goto(base + '/privacy/', { waitUntil: 'networkidle' });
  await page.locator('.trust-section [data-cookie-settings]').click();
  await expect(
    page
      .locator('dialog[data-cookie-dialog], dialog.cookie-settings-dialog, #cookie-settings-dialog')
      .first(),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  report.checks.push('Privacy cookie settings opens with the existing control');
  const nojs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const plain = await nojs.newPage();
  await plain.goto(base + '/faq/');
  await expect(plain.locator('[data-faq-question]')).toHaveCount(count);
  await expect(plain.locator('[data-faq-tools]')).toBeHidden();
  await plain.locator('[data-faq-question] summary').first().click();
  await expect(plain.locator('.trust-answer').first()).toBeVisible();
  await nojs.close();
  report.checks.push('FAQ remains readable and native disclosures work without JavaScript');
  assert.deepEqual(errors, []);
  report.status = 'passed';
  await context.close();
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  throw error;
} finally {
  writeFileSync(`${evidence}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
