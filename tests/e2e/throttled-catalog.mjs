import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Local only');
const out = process.env.EVIDENCE_DIR || 'reports/performance/throttled-catalog';
mkdirSync(out, { recursive: true });
const report = {
  started: new Date().toISOString(),
  base,
  experiment: process.env.PERFORMANCE_EXPERIMENT || null,
  release: realpathSync(resolve('work/performance-build')),
  scope:
    'Actual Chromium CDP throttling. LCP and first two card image readiness are separate. Not physical-device or Lighthouse simulation evidence.',
  conditions: {
    viewport: [412, 823],
    dpr: 1.75,
    latencyMs: 150,
    downloadBytesPerSecond: 200000,
    uploadBytesPerSecond: 93750,
    cpuSlowdown: 4,
  },
  checks: [],
  failures: [],
};
const browser = await chromium.launch();
try {
  for (const slug of ['thank-you', 'happy-birthday', 'grass']) {
    const context = await browser.newContext({
      viewport: { width: 412, height: 823 },
      deviceScaleFactor: 1.75,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    try {
      await page.addInitScript(() => {
        window.catalogPaintTiming = { lcp: [] };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            window.catalogPaintTiming.lcp.push({
              time: entry.startTime,
              url: entry.url,
              element: entry.element?.tagName,
              text: entry.element?.textContent?.slice(0, 100),
            });
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: 200000,
        uploadThroughput: 93750,
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const response = await page.goto(`${base}/clipart/${slug}/`, {
        waitUntil: 'domcontentloaded',
      });
      assert.equal(response.status(), 200);
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('.gallery .art-picture img')]
            .slice(0, 2)
            .filter((image) => image.complete && image.naturalWidth > 0).length === 2,
        undefined,
        { timeout: 30000 },
      );
      const timing = await page.evaluate(async () => {
        const images = [...document.querySelectorAll('.gallery .art-picture img')].slice(0, 2);
        await Promise.all(images.map((image) => image.decode()));
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return {
          ...window.catalogPaintTiming,
          firstTwoCardImagesDecodedAt: performance.now(),
          cards: images.map((image) => {
            const resource = performance.getEntriesByName(image.currentSrc).at(-1);
            const rect = image.getBoundingClientRect();
            return {
              src: image.currentSrc,
              naturalWidth: image.naturalWidth,
              naturalHeight: image.naturalHeight,
              top: rect.top,
              bottom: rect.bottom,
              responseEnd: resource?.responseEnd,
              transferSize: resource?.transferSize,
            };
          }),
          viewportWidth: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
        };
      });
      assert.ok(timing.lcp.length > 0, 'A real paint must be observed');
      assert.equal(timing.cards.length, 2);
      assert.ok(timing.documentWidth <= timing.viewportWidth + 1, 'No document overflow');
      await page.screenshot({ path: `${out}/${slug}.png` });
      report.checks.push({ slug, passed: true, ...timing });
    } catch (error) {
      report.failures.push({ slug, error: String(error.stack || error) });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  report.finished = new Date().toISOString();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
assert.deepEqual(report.failures, []);
