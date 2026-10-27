// Inspect rendered HTML, including no-JavaScript crawler-visible metadata.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4323';
const cases = [
  ['/', true],
  ['/categories/', true],
  ['/library-index/', true],
  ['/create/', true],
  ['/privacy/', true],
  ['/cookies/', true],
  ['/clipart/heart/', true],
  ['/collection/christmas-winter/', false],
  ['/new/', false],
  ['/black-and-white/', false],
  ['/art/winter-arctic-fox-resting/', true],
  ['/search/?q=flower', false],
  ['/favorites/', false],
  ['/edit/winter-arctic-fox-resting/', false],
  ['/404/', false],
];
const report = { date: new Date().toISOString(), base, checks: [], errors: [] };
for (const [path, indexable] of cases) {
  try {
    const res = await fetch(base + path, { signal: AbortSignal.timeout(30000) });
    assert.equal(res.status, path === '/404/' ? 404 : 200);
    const html = await res.text();
    const attribute = (tag, key) => tag.match(new RegExp(`\\b${key}=["']([^"']*)["']`, 'i'))?.[1];
    const tags = [...html.matchAll(/<meta\b[^>]*>/gi)]
      .map((m) => m[0])
      .filter((tag) => attribute(tag, 'name') === 'robots');
    assert.equal(tags.length, 1);
    const robots = attribute(tags[0], 'content');
    assert.equal(robots, indexable ? 'index,follow,max-image-preview:large' : 'noindex,follow');
    const canonical = [...html.matchAll(/<link\b[^>]*>/gi)]
      .map((m) => m[0])
      .find((tag) => attribute(tag, 'rel') === 'canonical');
    assert.equal(new URL(attribute(canonical, 'href')).origin, 'https://ultraclipart.com');
    report.checks.push({ path, status: res.status, indexable, robots });
  } catch (error) {
    report.errors.push({ path, message: error.message });
  }
}
mkdirSync('reports/assets-indexing', { recursive: true });
writeFileSync('reports/assets-indexing/local-meta.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.errors.length) process.exitCode = 1;
