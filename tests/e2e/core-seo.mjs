import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { installProductionCsp } from '../helpers/production-csp.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4326';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Local only');
const out = process.env.EVIDENCE_DIR || 'reports/seo-final/browser';
mkdirSync(out, { recursive: true });
const report = {
  started: new Date().toISOString(),
  release: realpathSync(resolve('work/performance-build')),
  scope:
    'Compiled local pages in Chromium/WebKit, mobile/desktop, JavaScript on/off. Controlled production CSP fixture, not a live Google Rich Results test.',
  checks: [],
  errors: [],
};
const routes = [
  '/',
  '/categories/',
  '/clipart/baby/',
  '/art/baby-pumpkin-costume-clipart/',
  '/about/',
  '/editorial-process/',
  '/search/?q=baby',
  '/favorites/',
];
for (const [engine, launcher] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  const browser = await launcher.launch();
  try {
    for (const width of [390, 1440])
      for (const javaScriptEnabled of [false, true]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          javaScriptEnabled,
        });
        const page = await context.newPage();
        await installProductionCsp(page);
        for (const path of routes) {
          try {
            const response = await page.goto(base + path, { waitUntil: 'domcontentloaded' });
            assert.equal(response.status(), 200);
            const data = await page.evaluate(() => {
              const nodes = [];
              const visit = (value) => {
                if (Array.isArray(value)) value.forEach(visit);
                else if (value && typeof value === 'object') {
                  if (value['@type']) nodes.push(value);
                  Object.values(value).forEach(visit);
                }
              };
              for (const script of document.querySelectorAll('script[type="application/ld+json"]'))
                visit(JSON.parse(script.textContent));
              return {
                title: document.title,
                canonical: document.querySelector('link[rel="canonical"]')?.href,
                h1: document.querySelectorAll('h1').length,
                robots: document.querySelector('meta[name="robots"]')?.content,
                description: document.querySelector('meta[name="description"]')?.content,
                nodes,
                png: document
                  .querySelector('link[rel="icon"][type="image/png"]')
                  ?.getAttribute('href'),
                ogUrl: document.querySelector('meta[property="og:url"]')?.content,
              };
            });
            assert.equal(data.h1, 1);
            assert.ok(data.description);
            const canonical = new URL(data.canonical);
            assert.equal(canonical.origin, 'https://ultraclipart.com');
            assert.equal(canonical.search, '');
            assert.equal(canonical.hash, '');
            assert.equal(data.ogUrl, canonical.href);
            const websites = data.nodes.filter((node) => node['@type'] === 'WebSite');
            assert.equal(websites.length, 1);
            assert.equal(websites[0]['@id'], 'https://ultraclipart.com/#website');
            assert.ok(
              data.nodes.some(
                (node) =>
                  node['@type'] === 'Organization' &&
                  node['@id'] === 'https://ultraclipart.com/#organization',
              ),
            );
            assert.equal(data.png, '/favicon-96.png');
            const privateRoute = path.startsWith('/search/') || path === '/favorites/';
            assert.equal(data.robots.includes('noindex'), privateRoute);
            assert.equal(
              data.nodes.filter((node) => node['@type'] === 'WebPage').length,
              privateRoute ? 0 : 1,
            );
            if (path === '/') {
              const png = await context.request.get(base + data.png),
                bytes = await png.body();
              assert.equal(png.status(), 200);
              assert.match(png.headers()['content-type'], /^image\/png/);
              assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
              assert.equal(bytes.readUInt32BE(16), 96);
              assert.equal(bytes.readUInt32BE(20), 96);
              await page.screenshot({
                path: `${out}/${engine}-${width}-${javaScriptEnabled ? 'js' : 'no-js'}.png`,
              });
            }
            report.checks.push({
              engine,
              width,
              javaScriptEnabled,
              path,
              canonical: data.canonical,
              passed: true,
            });
          } catch (error) {
            report.errors.push({
              engine,
              width,
              javaScriptEnabled,
              path,
              error: String(error.stack || error),
            });
          }
        }
        await context.close();
      }
  } finally {
    await browser.close();
  }
}
report.finished = new Date().toISOString();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checks: report.checks.length, errors: report.errors }));
assert.deepEqual(report.errors, []);
