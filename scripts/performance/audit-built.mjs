import {
  readFileSync,
  readdirSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  realpathSync,
} from 'node:fs';
import { resolve, join, relative } from 'node:path';
const root = resolve(import.meta.dirname, '../..'),
  built = realpathSync(join(root, 'work/performance-build'));
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
const files = walk(built),
  pages = files.filter((f) => f.endsWith('.html'));
const checked = new Set(),
  missing = new Set(),
  rows = [];
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const images = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  let previews = 0,
    responsive = 0;
  for (const tag of images) {
    const src = attr(tag, 'src'),
      set = attr(tag, 'srcset');
    if (src?.startsWith('/previews/')) previews++;
    if (set) responsive++;
    const urls = [src, ...(set?.split(',').map((v) => v.trim().split(/\s+/)[0]) || [])].filter(
      Boolean,
    );
    for (const url of urls) {
      if (!url.startsWith('/') || url.startsWith('//') || checked.has(url)) continue;
      // Detach a short attribute from V8's sliced HTML string. Otherwise retaining
      // one URL per artwork also retains every full HTML document during this audit.
      const copiedUrl = Buffer.from(url).toString();
      checked.add(copiedUrl);
      const path = url.split('?')[0];
      if (
        !existsSync(join(built, path)) &&
        (path.startsWith('/previews/ui/') || !existsSync(join(root, 'public', path)))
      )
        missing.add(copiedUrl);
    }
  }
  rows.push({
    path: '/' + relative(built, file).replace(/index\.html$/, ''),
    htmlBytes: Buffer.byteLength(html),
    images: images.length,
    previews,
    responsive,
    indexable: !/<meta name="robots" content="noindex/.test(html),
  });
}
const publicFiles = walk(join(root, 'public')).filter(
  (f) => !relative(join(root, 'public'), f).startsWith('catalog/'),
);
const deploymentUpperBound = new Set([
  ...files.map((f) => relative(built, f)),
  ...publicFiles.map((f) => relative(join(root, 'public'), f)),
]).size;
const summary = {
  release: built,
  date: new Date().toISOString(),
  type: 'Every generated HTML route: static source/link audit, not individual Lighthouse scores or visual interaction tests',
  pages: pages.length,
  distinctLocalImages: checked.size,
  missing: [...missing],
  deploymentFilesBeforeAnyVerifiedPageOffload: deploymentUpperBound,
  belowOwnerWarning: deploymentUpperBound < 85000,
  belowPagesLimit: deploymentUpperBound <= 100000,
};
mkdirSync(join(root, 'reports/performance'), { recursive: true });
writeFileSync(
  join(root, 'reports/performance/all-pages.json'),
  JSON.stringify({ summary, pages: rows }, null, 2),
);
writeFileSync(
  join(root, 'reports/performance/all-pages-summary.json'),
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary, null, 2));
if (missing.size || deploymentUpperBound > 100000) process.exitCode = 1;
