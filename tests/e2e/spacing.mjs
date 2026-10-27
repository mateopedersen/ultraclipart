import { chromium, webkit } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { templateRoutes } from '../../scripts/performance/routes.mjs';
import { inspectSpacing } from '../helpers/spacing-audit.mjs';
import { inspectLayout } from '../helpers/layout-audit.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Local only');
const baseline = process.env.SPACING_MODE === 'before';
const out = `reports/spacing/${baseline ? 'before' : 'after'}`;
mkdirSync(out, { recursive: true });
const art = JSON.parse(readFileSync('data/art.json')).filter((a) => a.published && a.indexable);
const topics = [...new Set(art.map((a) => a.topic))];
const representatives = [...new Map(art.map((a) => [a.topic, a.id])).values()];
const report = {
  started: new Date().toISOString(),
  mode: baseline ? 'before' : 'after',
  states: [],
  errors: [],
  scope:
    'Real browser spacing/layout measurement; JavaScript disabled for deterministic static layout. Separate interaction tests remain necessary.',
};
for (const [engine, implementation] of Object.entries({ chromium, webkit })) {
  const browser = await implementation.launch();
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const routes = baseline
      ? ['/', '/new/', '/black-and-white/', '/collection/animals-nature/']
      : [
          ...new Set([
            ...templateRoutes,
            ...(process.env.SPACING_SCOPE === 'templates'
              ? []
              : topics.map((t) => `/clipart/${t}/`)),
            ...(process.env.SPACING_SCOPE === 'templates'
              ? []
              : representatives.map((id) => `/art/${id}/`)),
          ]),
        ];
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      const widths = baseline
        ? [390, 900, 1440]
        : i < templateRoutes.length
          ? [320, 390, 768, 1024, 1440, 1920]
          : [390, 1440];
      // Chromium samples every subject/detail; WebKit covers every distinct template.
      if (!baseline && engine === 'webkit' && i >= templateRoutes.length) break;
      await page.setViewportSize({ width: widths[0], height: 950 });
      try {
        const response = await page.goto(base + route, { waitUntil: 'load', timeout: 30000 });
        assert.equal(response.status(), 200);
        await page.evaluate(() => document.fonts.ready);
        for (const width of widths) {
          await page.setViewportSize({ width, height: 950 });
          const result = await page.evaluate(inspectSpacing);
          const layout = await page.evaluate(inspectLayout);
          const errors = [];
          if (!baseline) {
            if (result.footerGap > 64 || result.footerGap < 0)
              errors.push(`Footer gap ${result.footerGap}`);
            if (result.contentFooterGap > 64 || result.contentFooterGap < 0)
              errors.push(`Content-to-footer gap ${result.contentFooterGap}`);
            if (result.uncoveredDocumentTail > 3)
              errors.push(`Uncovered space after footer ${result.uncoveredDocumentTail}`);
            if (route === '/' && result.sectionGaps.some((s) => s.gap > 56 || s.gap < -1))
              errors.push('Homepage section rhythm');
            for (const g of result.galleries) {
              if (!g.centered) errors.push(`Unbalanced final row: ${g.selector}`);
              if (g.widthVariation > 2) errors.push(`Unequal card widths: ${g.selector}`);
            }
            if (layout.horizontalOverflow || layout.clipped.length || layout.escaped.length)
              errors.push('Clipped or escaped layout');
            if (route === '/new/')
              assert.equal(result.galleries[0].count, 32, 'Keep all 32 original cards');
          }
          report.states.push({ engine, width, route, ...result, errors, passed: !errors.length });
          if (errors.length) report.errors.push({ engine, width, route, errors, layout });
          if (['/', '/new/'].includes(route) && [390, 1440].includes(width)) {
            await page.evaluate(() => {
              const main = document.querySelector('main');
              window.scrollTo(0, main.getBoundingClientRect().bottom + scrollY - innerHeight + 220);
            });
            await page.screenshot({
              path: `${out}/${engine}-${width}-${route === '/' ? 'home' : 'new'}-bottom.png`,
            });
          }
        }
      } catch (error) {
        report.errors.push({ engine, route, message: error.message });
      }
      if (i % 50 === 0) {
        writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
        console.log(
          `${engine}: ${i + 1} routes, ${report.states.length} states, ${report.errors.length} errors`,
        );
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
}
report.finished = new Date().toISOString();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ states: report.states.length, errors: report.errors.length }));
if (!baseline) assert.deepEqual(report.errors, []);
