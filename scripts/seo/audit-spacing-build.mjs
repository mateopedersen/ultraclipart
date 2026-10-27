// Checks every generated route for the shared spacing/gallery rules. Browser
// measurements separately cover each template, subject and representative art.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { htmlFiles } from './image-seo.mjs';
const root = resolve(import.meta.dirname, '../..'),
  built = join(root, 'work/performance-build');
const errors = [],
  pages = [];
for (const file of htmlFiles(built)) {
  const html = readFileSync(file, 'utf8'),
    page = relative(built, file);
  const failed = [];
  if (!html.includes('--page-footer-gap:') || !html.includes('var(--page-footer-gap)'))
    failed.push('missing shared footer spacing');
  if (!/footer\.site-footer\{[^}]*margin-top:0(?:[;}])/.test(html))
    failed.push('footer adds another outer gap');
  if (!html.includes('--gallery-columns:') || !html.includes('justify-content:center'))
    failed.push('missing shared gallery flow');
  if (!html.includes('<main') || !html.includes('class="site-footer"'))
    failed.push('missing shared layout');
  if (failed.length) errors.push({ page, fields: failed });
  pages.push(page);
}
const report = {
  date: new Date().toISOString(),
  pages: pages.length,
  errors,
  scope:
    'All compiled HTML routes checked for shared source rules. This is not a claim that every URL received an individual visual review.',
};
mkdirSync(join(root, 'reports/spacing'), { recursive: true });
writeFileSync(
  join(root, 'reports/spacing/all-compiled-pages.json'),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
if (errors.length) process.exitCode = 1;
