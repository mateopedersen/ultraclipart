import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4323',
  engine = process.env.UC_BROWSER || 'chromium';
const out = process.env.EVIDENCE_DIR || `reports/brand-accents/${engine}`;
mkdirSync(out, { recursive: true });
const browser = await { chromium, webkit }[engine].launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const report = { base, engine, status: 'running', colors: [], errors: [] };
try {
  for (const [route, selector] of [
    ['/', '.home-showcase h1 > span'],
    ['/favorites/', '.boards-hero h1 span'],
    ['/about/', '.about-hero h1 span'],
    ['/create/', '.studio-intro h1 span'],
    ['/ai-clipart-generator/', '.ai-heading h1 span'],
    ['/ai-clipart-generator/', '.ai-section-heading > span'],
    ['/collections/', '.collection-directory-hero h1 span'],
    ['/categories/', '.discovery-hero h1 span'],
    ['/privacy/', '.footer-invitation h2 span'],
  ]) {
    await page.goto(base + route);
    await page.locator(selector).first().waitFor({ state: 'attached' });
    await page.evaluate(() => document.fonts.ready);
    const colors = await page
      .locator(selector)
      .evaluateAll((es) => es.map((e) => getComputedStyle(e).color));
    assert.ok(colors.length);
    assert.ok(
      colors.every((c) => c === 'rgb(20, 100, 212)'),
      JSON.stringify({ route, selector, colors }),
    );
    report.colors.push({ route, selector, colors });
    if (route === '/' || route === '/favorites/')
      await page
        .locator('h1')
        .first()
        .screenshot({ path: `${out}/${route === '/' ? 'home' : 'favorites'}-heading.png` });
  }
  report.status = 'passed';
} finally {
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report));
