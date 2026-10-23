import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4346';
const label = process.env.CLS_LABEL ?? 'baseline';
const output = resolve('reports/detail-cls');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_BIN ? { executablePath: process.env.CHROMIUM_BIN } : {}),
});
const report = {
  date: new Date().toISOString(),
  base,
  label,
  purpose:
    'Cold local production build, simulating a device without locally installed Avenir. Artificial font/image delays isolate CLS causes; not a PageSpeed or field score.',
  runs: [],
};
try {
  for (const width of [390, 1440])
    for (const condition of [
      { name: 'normal', font: 0, image: 0 },
      { name: 'font-delay', font: 1800, image: 0 },
      { name: 'image-delay', font: 0, image: 1800 },
      { name: 'both-delayed', font: 1800, image: 1800 },
    ]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/*.css', async (route) => {
        const response = await route.fetch();
        const css = await response.text();
        // macOS has Avenir locally; remove only those local choices to reproduce an Inter-using machine.
        await route.fulfill({
          response,
          body: css.replace(/(?:["']?Avenir Next["']?),Avenir,/g, ''),
        });
      });
      let fontRequests = 0;
      await page.route(/\.woff2?(?:\?|$)/, async (route) => {
        fontRequests++;
        if (condition.font) await new Promise((resolve) => setTimeout(resolve, condition.font));
        await route.continue();
      });
      await page.route(/\/pumpkin-curly-vine\.(?:webp|svg)(?:\?|$)/, async (route) => {
        if (condition.image) await new Promise((resolve) => setTimeout(resolve, condition.image));
        await route.continue();
      });
      await page.addInitScript(() => {
        window.__cls = { value: 0, shifts: [], snapshots: [] };
        const snapshot = (label) => {
          const r = document.querySelector('#art-preview')?.getBoundingClientRect();
          const i = document.querySelector('#art-preview img')?.getBoundingClientRect();
          const s = document.querySelector('.detail > section')?.getBoundingClientRect();
          window.__cls.snapshots.push({
            label,
            time: performance.now(),
            preview: r?.toJSON(),
            image: i?.toJSON(),
            section: s?.toJSON(),
          });
        };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            if (!entry.hadRecentInput) {
              window.__cls.value += entry.value;
              window.__cls.shifts.push({
                time: entry.startTime,
                value: entry.value,
                sources: entry.sources.map((source) => ({
                  tag: source.node?.tagName,
                  class: source.node?.className,
                  text: source.node?.textContent?.slice(0, 100),
                  previous: source.previousRect.toJSON(),
                  current: source.currentRect.toJSON(),
                })),
              });
            }
        }).observe({ type: 'layout-shift', buffered: true });
        document.addEventListener('DOMContentLoaded', () => {
          snapshot('dom');
          setTimeout(() => snapshot('before-delayed-assets'), 500);
          document.fonts.ready.then(() => snapshot('fonts-ready'));
        });
      });
      await page.goto(base + '/art/pumpkin-curly-vine/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.locator('#art-preview img').evaluate((image) => image.decode());
      await page.waitForTimeout(700);
      const result = await page.evaluate(() => {
        const image = document.querySelector('#art-preview img');
        return {
          ...window.__cls,
          font: getComputedStyle(document.documentElement).fontFamily,
          image: {
            complete: image.complete,
            width: image.naturalWidth,
            height: image.naturalHeight,
            source: image.currentSrc,
          },
          overflow: document.documentElement.scrollWidth > innerWidth,
          fontMetrics: [400, 600, 700].map((weight) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const text = document.querySelector('.detail > section').textContent;
            const family = getComputedStyle(document.documentElement).fontFamily.includes(
              'UltraClipart Sans',
            )
              ? 'UltraClipart Sans'
              : 'Inter';
            ctx.font = `${weight} 100px "${family}"`;
            const targetMetrics = ctx.measureText(text);
            const target = targetMetrics.width;
            ctx.font = `${weight} 100px Arial`;
            return {
              weight,
              ratio: target / ctx.measureText(text).width,
              fontAscent: targetMetrics.fontBoundingBoxAscent,
              fontDescent: targetMetrics.fontBoundingBoxDescent,
            };
          }),
        };
      });
      const run = {
        width,
        condition: condition.name,
        fontDelay: condition.font,
        imageDelay: condition.image,
        fontRequests,
        ...result,
        pageErrors: errors,
      };
      report.runs.push(run);
      console.log(
        JSON.stringify({
          width,
          condition: condition.name,
          cls: result.value,
          fontRequests,
          shifts: result.shifts.length,
          imageWidth: result.image.width,
        }),
      );
      await page.screenshot({
        path: resolve(output, `${label}-${width}-${condition.name}.png`),
        fullPage: false,
      });
      await context.close();
    }
} finally {
  await browser.close();
  writeFileSync(resolve(output, `${label}.json`), JSON.stringify(report, null, 2) + '\n');
}
