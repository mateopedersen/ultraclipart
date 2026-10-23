#!/usr/bin/env node
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const base = process.env.BASE_URL;
if (!base || new URL(base).protocol !== 'https:')
  throw new Error('Set BASE_URL to the deployed HTTPS website');
const output = resolve(process.env.REPORT_DIR ?? resolve(root, 'reports/live'));
mkdirSync(output, { recursive: true });
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1];
const tags = (html, name) =>
  [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((match) => match[0]);
const canonical = (html) =>
  attribute(tags(html, 'link').find((tag) => attribute(tag, 'rel') === 'canonical') ?? '', 'href');
const robots = (html) =>
  attribute(
    tags(html, 'meta').find((tag) => attribute(tag, 'name') === 'robots') ?? '',
    'content',
  ) ?? '';
const report = {
  date: new Date().toISOString(),
  base,
  status: 'running',
  pages: [],
  resources: [],
  failures: [],
};
const targets = walk(dist)
  .filter((path) => path.endsWith('.html') && !path.endsWith('/404.html'))
  .map((path) => ({
    route: '/' + relative(dist, path).replace(/index\.html$/, ''),
    html: readFileSync(path, 'utf8'),
  }));
const resources = new Set();
async function checkPage(target) {
  const url = new URL(target.route, base).href;
  const result = { url, status: 0, issues: [] };
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    result.status = response.status;
    result.finalUrl = response.url;
    result.headers = Object.fromEntries(
      [
        'content-security-policy',
        'x-content-type-options',
        'referrer-policy',
        'x-frame-options',
        'permissions-policy',
        'strict-transport-security',
        'cross-origin-opener-policy',
      ].map((name) => [name, response.headers.get(name)]),
    );
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
    if (new URL(response.url).protocol !== 'https:')
      result.issues.push('Page redirected away from HTTPS');
    const html = await response.text();
    result.canonical = canonical(html);
    result.robots = robots(html);
    result.revision = attribute(
      tags(html, 'meta').find((tag) => attribute(tag, 'name') === 'build-revision') ?? '',
      'content',
    );
    if (process.env.EXPECTED_REVISION && result.revision !== process.env.EXPECTED_REVISION)
      result.issues.push('Unexpected deployed revision');
    const imageSources = (text) =>
      tags(text, 'img')
        .map((tag) => attribute(tag, 'src'))
        .sort();
    if (JSON.stringify(imageSources(html)) !== JSON.stringify(imageSources(target.html)))
      result.issues.push('Image sources differ from verified build');
    if (result.canonical !== canonical(target.html))
      result.issues.push('Canonical differs from tested build');
    if (robots(target.html).includes('noindex') && !result.robots.includes('noindex'))
      result.issues.push('Required noindex missing');
    if (!/<html\b[^>]*lang=["']en(?:-US)?["']/i.test(html))
      result.issues.push('English language metadata missing');
    if ([...html.matchAll(/<h1\b/gi)].length !== 1) result.issues.push('Expected one H1');
    if (!/<title>[^<]+<\/title>/i.test(html)) result.issues.push('Page title missing');
    if (result.headers['x-content-type-options'] !== 'nosniff')
      result.issues.push('nosniff security header missing');
    if (!result.headers['content-security-policy']) result.issues.push('CSP missing');
    if (result.headers['strict-transport-security'] !== 'max-age=31536000')
      result.issues.push('HSTS differs from release policy');
    if (result.headers['cross-origin-opener-policy'] !== 'same-origin')
      result.issues.push('Opener isolation missing');
    for (const tag of tags(html, 'img')) {
      const src = attribute(tag, 'src');
      if (src && !src.startsWith('data:')) resources.add(new URL(src, url).href);
    }
    for (const tag of tags(html, 'script')) {
      const src = attribute(tag, 'src');
      if (src) resources.add(new URL(src, url).href);
    }
    for (const tag of tags(html, 'link'))
      if (['stylesheet', 'modulepreload'].includes(attribute(tag, 'rel'))) {
        const href = attribute(tag, 'href');
        if (href) resources.add(new URL(href, url).href);
      }
    const editable = attribute(
      tags(html, 'section').find((tag) => /\bdata-source=/.test(tag)) ?? '',
      'data-source',
    );
    if (editable) resources.add(new URL(editable, url).href);
  } catch (error) {
    result.issues.push(error.message);
  }
  report.pages.push(result);
  if (result.issues.length) report.failures.push({ url, issues: result.issues });
}
async function parallel(queue, fn) {
  const pending = [...queue];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (pending.length) await fn(pending.shift());
    }),
  );
}
await parallel(targets, checkPage);
for (const path of [
  '/robots.txt',
  '/sitemap.xml',
  '/sitemap-pages.xml',
  '/search-data/manifest.json',
])
  resources.add(new URL(path, base).href);
await parallel([...resources], async (url) => {
  const result = { url, status: 0, bytes: 0, issues: [] };
  try {
    if (new URL(url).protocol !== 'https:')
      throw new Error('Mixed or unsupported resource protocol');
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    result.status = response.status;
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
    if (new URL(response.url).protocol !== 'https:')
      result.issues.push('Resource redirected away from HTTPS');
    result.bytes = (await response.arrayBuffer()).byteLength;
    if (!result.bytes) result.issues.push('Empty resource');
  } catch (error) {
    result.issues.push(error.message);
  }
  report.resources.push(result);
  if (result.issues.length) report.failures.push({ url, issues: result.issues });
});
const unknown = new URL('/__ultraclipart_smoke_missing_route__/', base).href;
try {
  const response = await fetch(unknown, { signal: AbortSignal.timeout(20000) });
  report.notFoundStatus = response.status;
  if (response.status !== 404)
    report.failures.push({ url: unknown, issues: [`Expected404, received${response.status}`] });
} catch (error) {
  report.failures.push({ url: unknown, issues: [error.message] });
}
report.pages.sort((a, b) => a.url.localeCompare(b.url));
report.resources.sort((a, b) => a.url.localeCompare(b.url));
report.status = report.failures.length ? 'failed' : 'passed';
writeFileSync(resolve(output, 'http.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      status: report.status,
      pages: report.pages.length,
      resources: report.resources.length,
      notFoundStatus: report.notFoundStatus,
      failures: report.failures,
    },
    null,
    2,
  ),
);
if (report.status !== 'passed') process.exitCode = 1;
