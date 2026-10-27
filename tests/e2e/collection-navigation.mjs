import { chromium, webkit, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://127.0.0.1:4323';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base))
  throw new Error('This audit is local-only.');
const engine = process.env.UC_BROWSER || 'chromium';
const out = process.env.EVIDENCE_DIR || `reports/collection-seo/${engine}`;
mkdirSync(out, { recursive: true });
const json = (name) =>
  JSON.parse(readFileSync(new URL('../../data/' + name, import.meta.url), 'utf8'));
const all = json('art.json').filter((item) => item.published && item.indexable);
const byId = new Map(all.map((item) => [item.id, item]));
const relations = json('topic-relations.json');
const eligible = new Set(
  Object.keys(relations).filter((topic) => all.filter((item) => item.topic === topic).length >= 50),
);
const topics = process.env.UC_TOPICS?.split(',') || [...eligible];
const report = {
  engine,
  base,
  started: new Date().toISOString(),
  pages: [],
  failures: [],
  artworkIds: [],
};
const seen = new Set();
const browser = await { chromium, webkit }[engine].launch();
try {
  // Two independent viewports: all routes are really navigated in each browser context.
  for (const width of (process.env.UC_WIDTHS || '390,1440').split(',').map(Number)) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    let pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    for (const topic of topics) {
      pageErrors = [];
      const row = { route: `/clipart/${topic}/`, width, cards: 0, links: [], status: 'failed' };
      try {
        const response = await page.goto(base + row.route, { waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200);
        await page.evaluate(() => document.fonts.ready);
        const cookie = page.locator('[data-cookie-choice="necessary"]:visible').first();
        if (await cookie.count()) await cookie.click();
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          'href',
          `https://ultraclipart.com${row.route}`,
        );
        assert.equal(await page.locator('main a[href^="/search/?"]').count(), 0);
        row.links = await page
          .locator('[data-related-collections] a')
          .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
        assert.deepEqual(
          row.links,
          relations[topic].filter((slug) => eligible.has(slug)).map((slug) => `/clipart/${slug}/`),
        );
        const cards = await page.locator('.gallery .art-card').evaluateAll((nodes) =>
          nodes.map((node) => {
            const img = node.querySelector('.art-picture img');
            return {
              id: node.getAttribute('data-id'),
              alt: img?.getAttribute('alt'),
              title: img?.getAttribute('title'),
            };
          }),
        );
        assert.equal(cards.length, all.filter((item) => item.topic === topic).length);
        for (const card of cards) {
          const source = byId.get(card.id);
          assert.equal(card.alt, source.alt, card.id);
          assert.equal(card.title, source.title, card.id);
          seen.add(card.id);
        }
        row.cards = cards.length;
        await expect(page.locator('.collection-gallery-heading h2')).toHaveText(
          'Choose a design for your next idea',
        );
        await expect(page.locator('.collection-gallery-count')).toContainText(
          cards.length.toLocaleString('en-US'),
        );
        const failures = row.links.length
          ? await page.locator('[data-related-collections]').evaluate((section) => {
              const problems = [];
              const gallery = document.querySelector('main .gallery');
              if (
                !gallery ||
                !(gallery.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING)
              )
                problems.push('related collections must follow the complete artwork gallery');
              if (
                gallery &&
                section.getBoundingClientRect().top < gallery.getBoundingClientRect().bottom - 1
              )
                problems.push('related collections appear above or overlap the artwork gallery');
              if (document.documentElement.scrollWidth > innerWidth + 1)
                problems.push('page overflow');
              for (const el of section.querySelectorAll('a, strong, img')) {
                const r = el.getBoundingClientRect();
                if (r.left < -1 || r.right > innerWidth + 1)
                  problems.push(`outside viewport: ${el.tagName}`);
                if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)
                  problems.push(`clipped: ${el.tagName}`);
                if (el.tagName === 'IMG' && (!el.alt || !el.title))
                  problems.push('missing image metadata');
              }
              return problems;
            })
          : [];
        assert.deepEqual(failures, []);
        assert.deepEqual(pageErrors, []);
        row.status = 'passed';
        if (['baby', 'headphones', 'winter', 'sunrise-on-the-reaping'].includes(topic)) {
          await page.locator('[data-related-collections]').scrollIntoViewIfNeeded();
          await expect
            .poll(() =>
              page
                .locator('[data-related-collections] img')
                .evaluateAll((images) =>
                  images.every((img) => img.complete && img.naturalWidth > 0),
                ),
            )
            .toBe(true);
          await page.screenshot({ path: `${out}/${topic}-${width}.png` });
        }
      } catch (error) {
        row.status = 'failed';
        row.error = error.message;
        report.failures.push(row);
      }
      report.pages.push(row);
      if (report.pages.length % 25 === 0)
        console.log(
          `${engine}: ${report.pages.length} page/viewport checks, ${report.failures.length} failures`,
        );
    }
    await context.close();
  }
} finally {
  await browser.close();
  report.artworkIds = [...seen];
  report.finished = new Date().toISOString();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
}
console.log(
  JSON.stringify({
    engine,
    checks: report.pages.length,
    artwork: seen.size,
    failures: report.failures.length,
  }),
);
assert.equal(report.failures.length, 0, JSON.stringify(report.failures.slice(0, 3)));
