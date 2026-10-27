import { chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const engine = process.env.UC_BROWSER || 'chromium',
  base = process.env.BASE_URL || 'http://127.0.0.1:4323';
const browser = await { chromium, webkit }[engine].launch(),
  context = await browser.newContext(),
  page = await context.newPage();
const report = { engine, states: [], errors: [], status: 'running' };
try {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      '/',
      '/collections/',
      '/categories/',
      '/about/',
      '/favorites/',
      '/create/',
      '/print-size/',
      '/art/sunflower-straw-hat/',
      '/guides/webp-pdf-and-editable-projects/',
    ]) {
      await page.goto(base + route);
      await page.evaluate(() => document.fonts.ready);
      const labels = await page
        .locator(
          '.eyebrow,.collection-eyebrow,.discovery-eyebrow,.about-eyebrow,.boards-eyebrow,.related-eyebrow,.studio-kicker,.print-eyebrow,.creative-project-eyebrow,.home-benefits-eyebrow',
        )
        .evaluateAll((nodes) =>
          nodes
            .filter((n) => n.getBoundingClientRect().width && n.getBoundingClientRect().height)
            .map((n) => ({
              text: n.textContent.trim(),
              color: getComputedStyle(n).color,
              size: getComputedStyle(n).fontSize,
            })),
        );
      for (const label of labels)
        if (label.color !== 'rgb(20, 100, 212)') report.errors.push({ route, width, ...label });
      if (route === '/collections/') {
        const axe = await new AxeBuilder({ page })
          .setLegacyMode(engine === 'webkit')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        for (const violation of axe.violations)
          report.errors.push({
            route,
            width,
            id: violation.id,
            nodes: violation.nodes.map((n) => n.target),
          });
      }
      report.states.push({ route, width, labels: labels.length });
    }
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} finally {
  writeFileSync(`reports/categories-refresh/brand-${engine}.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(
  JSON.stringify({
    engine,
    states: report.states.length,
    errors: report.errors,
    status: report.status,
  }),
);
