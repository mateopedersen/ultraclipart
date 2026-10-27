import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Local only');
const out = process.env.EVIDENCE_DIR || 'reports/performance/throttled-editor';
mkdirSync(out, { recursive: true });
const report = {
  started: new Date().toISOString(),
  scope: 'Actual Chromium CDP throttling, not Lighthouse simulation or a physical device test.',
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
  for (const id of ['baby-pumpkin-costume-clipart', 'classic-white-volleyball-realistic-clipart']) {
    const context = await browser.newContext({
      viewport: { width: 412, height: 823 },
      deviceScaleFactor: 1.75,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    try {
      await page.addInitScript(() => {
        window.editorTiming = { lcp: [], editingReadyAt: null };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            window.editorTiming.lcp.push({
              time: entry.startTime,
              url: entry.url,
              element: entry.element?.tagName,
            });
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        addEventListener('DOMContentLoaded', () => {
          const root = document.querySelector('.uc-editor');
          const observer = new MutationObserver(() => {
            if (root?.getAttribute('aria-busy') !== 'true') {
              window.editorTiming.editingReadyAt = performance.now();
              observer.disconnect();
            }
          });
          if (root) observer.observe(root, { attributes: true, attributeFilter: ['aria-busy'] });
        });
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
      await page.goto(base + '/edit/' + id + '/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-artwork-canvas] image')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('.uc-editor')).not.toHaveAttribute('aria-busy', 'true', {
        timeout: 30000,
      });
      const timing = await page.evaluate(async () => {
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return {
          ...window.editorTiming,
          resources: performance
            .getEntriesByType('resource')
            .filter((r) => r.name.includes('/previews/p1/') || r.name.includes('/catalog/'))
            .map((r) => ({
              url: r.name,
              start: r.startTime,
              end: r.responseEnd,
              transferSize: r.transferSize,
            })),
        };
      });
      assert.ok(timing.editingReadyAt > 0, 'actual readiness must be observed');
      assert.ok(timing.lcp.length > 0, 'actual paint must be observed');
      assert.ok(
        timing.resources.some((r) => r.url.includes('/catalog/')),
        'the original must actually load',
      );
      await expect(page.locator('.uc-workspace')).not.toHaveAttribute('inert', '');
      await page.screenshot({ path: `${out}/${id}.png` });
      report.checks.push({ id, passed: true, ...timing });
    } catch (error) {
      report.failures.push({ id, message: error.stack });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  report.finished = new Date().toISOString();
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
assert.deepEqual(report.failures, []);
