import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { loadTypescript } from '../helpers/typescript.mjs';
const { cuteConfidence } = await loadTypescript('src/lib/cute-discovery.ts');
const all = JSON.parse(await readFile('data/art.json', 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:4353';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const report = { visited: [], fallback: false, noJavascript: false, errors: [] };
page.on('pageerror', (e) => report.errors.push(e.message));
await mkdir('reports/cute-surprise', { recursive: true });
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  const response = await page.request.get(base + '/surprise-picks.json');
  assert.equal(response.status(), 200);
  const index = await response.json();
  assert.ok(index.items.length > 100 && index.items.length <= 512);
  for (const pick of index.items)
    assert.ok(cuteConfidence(all.find((x) => x.id === pick.id)) >= 68, pick.id);
  for (let i = 0; i < 8; i++) {
    const link = page.locator('.site-surprise-link');
    await link.hover();
    await link.click();
    await page.waitForURL('**/art/**');
    const id = new URL(page.url()).pathname.split('/')[2];
    assert.ok(!report.visited.includes(id), 'No repeated selection');
    assert.ok(cuteConfidence(all.find((x) => x.id === id)) >= 68);
    report.visited.push(id);
    await expect(page.locator('main h1')).toBeVisible();
  }
  const offline = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const fallback = await offline.newPage();
  await fallback.route('**/surprise-picks.json*', (r) => r.abort());
  await fallback.goto(base);
  await fallback.locator('.site-surprise-link').hover();
  await fallback.locator('.site-surprise-link').click();
  await fallback.waitForURL('**/art/**');
  assert.ok(cuteConfidence(all.find((x) => fallback.url().includes('/' + x.id + '/'))) >= 68);
  report.fallback = true;
  await offline.close();
  const nojs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 1000 },
  });
  const plain = await nojs.newPage();
  await plain.goto(base);
  await plain.locator('.site-surprise-link').click();
  await plain.waitForURL('**/art/**');
  assert.ok(cuteConfidence(all.find((x) => plain.url().includes('/' + x.id + '/'))) >= 68);
  report.noJavascript = true;
  await nojs.close();
  assert.deepEqual(report.errors, []);
  report.indexCount = index.items.length;
  report.subjectCount = new Set(index.items.map((x) => x.topic)).size;
  report.status = 'passed';
} finally {
  await browser.close();
  await writeFile('reports/cute-surprise/report.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
