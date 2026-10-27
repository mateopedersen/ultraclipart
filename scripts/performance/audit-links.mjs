import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const built = join(root, 'work/performance-build');
const publicRoot = join(root, 'public');
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
const pages = walk(built).filter((f) => f.endsWith('.html'));
const urls = new Map();
const errorPageIdentifiers = [];
const redirects = new Set(
  readFileSync(join(publicRoot, '_redirects'), 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => line.trim().split(/\s+/)[0]),
);
for (const file of pages) {
  const route = '/' + relative(built, file).replace(/index\.html$/, '');
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(/<(a|link|script|iframe|source)\b[^>]*>/gi)) {
    const attribute = match[1] === 'a' || match[1] === 'link' ? 'href' : 'src';
    const raw = match[0].match(new RegExp(`\\b${attribute}="([^"]+)"`, 'i'))?.[1];
    if (!raw || raw.startsWith('#')) continue;
    let target;
    try {
      target = new URL(raw.replaceAll('&amp;', '&'), 'https://ultraclipart.com' + route);
    } catch {
      continue;
    }
    if (target.origin !== 'https://ultraclipart.com') continue;
    // Copy the short string instead of retaining its full source HTML buffer.
    const path = Buffer.from(decodeURIComponent(target.pathname)).toString();
    // A noindex error document's canonical identifies the error itself; it is
    // not a navigation link or a resource expected to return HTTP 200. Record
    // this separately. An actual anchor to the same path is still checked.
    if (
      route === '/404.html' &&
      match[1] === 'link' &&
      /\brel="canonical"/.test(match[0]) &&
      /<meta name="robots" content="noindex/.test(html)
    ) {
      errorPageIdentifiers.push({ path, document: route, kind: 'noindex error canonical' });
      continue;
    }
    if (!urls.has(path)) urls.set(path, { path, firstSeenOn: route, element: match[1] });
  }
}
const missing = [],
  redirectTargets = [],
  dynamic = [];
for (const [path, info] of urls) {
  if (path.startsWith('/api/') || path.startsWith('/share/')) {
    dynamic.push(info);
    continue;
  }
  if (redirects.has(path)) {
    redirectTargets.push(info);
    continue;
  }
  const present = [built, publicRoot].some((dir) => {
    const file = resolve(dir, '.' + path);
    if (file !== dir && !file.startsWith(dir + '/')) return false;
    if (!existsSync(file)) return false;
    return statSync(file).isFile() || existsSync(join(file, 'index.html'));
  });
  if (!present) missing.push(info);
}
const report = {
  date: new Date().toISOString(),
  pages: pages.length,
  distinctInternalPaths: urls.size,
  scope:
    'All generated HTML anchor/link/script/iframe/source URLs checked against local build/public files. External destinations, fragments, runtime links and API behavior are not validated by this audit.',
  missing,
  redirectTargets,
  dynamic,
  errorPageIdentifiers,
};
writeFileSync(join(root, 'reports/performance/all-links.json'), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    pages: pages.length,
    paths: urls.size,
    missing,
    redirects: redirectTargets.length,
    dynamic: dynamic.length,
  }),
);
if (missing.length) process.exitCode = 1;
