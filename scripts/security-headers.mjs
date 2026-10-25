import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { readPublication } from './publication-policy.mjs';
import { retirementPolicy, createRetiredHandler } from './retired-routes.mjs';
import { pruneCatalogOutput } from './prune-catalog-output.mjs';
import { pruneVerifiedCatalogPages } from './catalog-pages/prune.mjs';
import { releaseRevision } from './release-revision.mjs';
import { assertPagesFileCount, PAGES_FILE_LIMIT } from '../src/lib/pages-limits.ts';
import { build as bundleWorker } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const files = (path) =>
  readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)],
  );
const htmlFiles = files(dist).filter((file) => file.endsWith('.html'));
const hashes = new Set();

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (
      /\bsrc\s*=/.test(match[1]) ||
      /type="application\/(?:ld\+)?json"/.test(match[1]) ||
      !match[2].trim()
    )
      continue;
    hashes.add(`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
  }
}
const base = readFileSync(join(root, 'public/_headers'), 'utf8');
const csp = base.replace(
  "script-src 'self' 'wasm-unsafe-eval';",
  `script-src 'self' 'wasm-unsafe-eval' ${[...hashes].join(' ')};`,
);
const aiCsp =
  csp
    .split('\n')
    .find((line) => line.startsWith('  Content-Security-Policy:'))
    .replace("script-src 'self'", "script-src 'self' https://challenges.cloudflare.com")
    .replace("connect-src 'self'", "connect-src 'self' https://challenges.cloudflare.com") +
  "; frame-src https://challenges.cloudflare.com; worker-src 'self'";
const searchVersion = JSON.parse(
  readFileSync(join(dist, 'search-data/manifest.json'), 'utf8'),
).version;
writeFileSync(
  join(dist, '_headers'),
  `${csp}\n${['/ai-clipart-generator/', '/create/', '/edit/*'].map((route) => `${route}\n  ! Content-Security-Policy\n${aiCsp}`).join('\n')}\n/search-data/${searchVersion}/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
);

if (process.env.CF_PAGES === '1') {
  const publication = readPublication(root);
  const allowed = new Set(publication.urls);
  const localPaths = new Set(publication.localPaths);
  const compiled = new Set();
  // Every compiled media reference must belong to the verified release. Waves
  // may retain different immutable URLs instead of copying all earlier media.
  for (const file of files(dist).filter((path) => /\.(html|json|js)$/.test(path))) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/["'](\/[A-Za-z0-9/._-]+)["']/g)) {
      if (localPaths.has(match[1]))
        throw new Error(`Production still references local media: ${file}`);
    }
    for (const match of text.matchAll(/https:\/\/assets\.ultraclipart\.com\/[A-Za-z0-9/._-]+/g)) {
      if (!allowed.has(match[0])) throw new Error(`Unverified compiled CDN reference: ${match[0]}`);
      compiled.add(match[0]);
    }
  }
  for (const url of allowed)
    if (!compiled.has(url))
      throw new Error(`Verified media was omitted from compiled output: ${url}`);
  if (process.env.CATALOG_OFFLOAD_COLLECTION) {
    const collection = process.env.CATALOG_OFFLOAD_COLLECTION;
    const revision = releaseRevision();
    const count = pruneVerifiedCatalogPages(
      dist,
      JSON.parse(readFileSync(join(root, 'data/art.json'), 'utf8')),
      join(root, 'work/catalog-pages', collection, revision, 'verified-manifest.json'),
      collection,
      revision,
    );
    console.log(`Catalog pages: ${count} verified HTML files moved to private R2.`);
  }
  // A locally staged next wave must not leak into a manual production build.
  // Sources and unrelated UI assets, including the blank studio, stay intact.
  pruneCatalogOutput(dist);
  for (const path of publication.localPaths) rmSync(join(dist, path.slice(1)), { force: true });
  console.log(`CDN release: ${publication.files} verified files, ${publication.bytes} bytes.`);
}
const apiRoutes = ['/api/*', '/share/*'];
// A small book collection pilot keeps existing artwork on static delivery.
// Wider routing is enabled only after the new ingestion path is verified.
const catalogRoutes = ['/art/book*', '/edit/book*'];
const responseHeaders = Object.fromEntries(
  [...csp.split('/_astro/*')[0].matchAll(/^  ([\w-]+): (.+)$/gm)].map((match) => [
    match[1],
    match[2],
  ]),
);
const editorHeaders = {
  ...responseHeaders,
  'Content-Security-Policy': aiCsp.trim().replace(/^Content-Security-Policy:\s*/, ''),
};
const withdrawnIds = JSON.parse(
  readFileSync(join(root, 'data/retired-artwork.json'), 'utf8'),
).artworkIds;
const retirement = retirementPolicy(
  [
    ...JSON.parse(readFileSync(join(root, 'data/topics.json'), 'utf8')).topics,
    ...JSON.parse(readFileSync(join(root, 'data/extra-topics.json'), 'utf8')),
  ],
  JSON.parse(readFileSync(join(root, 'data/art.json'), 'utf8')),
  JSON.parse(readFileSync(join(root, 'data/retired-artwork.json'), 'utf8')),
  files(dist).map((path) => '/' + relative(dist, path)),
  100 - apiRoutes.length - catalogRoutes.length,
);
let retiredWorker = '({fetch: (request, env) => env.ASSETS.fetch(request)})';
if (retirement) {
  writeFileSync(
    join(dist, '_routes.json'),
    JSON.stringify({
      ...retirement.routes,
      include: [...retirement.routes.include, ...apiRoutes, ...catalogRoutes],
    }),
  );
  retiredWorker = `(${createRetiredHandler.toString()})(${JSON.stringify(retirement.retired)}, ${JSON.stringify(responseHeaders)})`;
  console.log(
    `Unavailable routes: ${retirement.retired.length}; live collections/assets bypass the 404 function.`,
  );
} else {
  writeFileSync(
    join(dist, '_routes.json'),
    JSON.stringify({ version: 1, include: [...apiRoutes, ...catalogRoutes], exclude: [] }),
  );
}
await bundleWorker({
  stdin: {
    contents: `import {handleAi} from './server/ai/handler.mjs';
import {handleShare} from './server/share/handler.mjs';
import {handleCatalogPage} from './server/catalog/pages.mjs';
import {handleCookieRegion} from './server/cookies/region.mjs';
const retired = ${retiredWorker};
const catalogOptions = ${JSON.stringify({ pageHeaders: responseHeaders, editorHeaders, withdrawnIds, revision: releaseRevision() })};
export default {fetch(request, env, context) { const path = new URL(request.url).pathname; return path === '/api/cookie-region.json' ? handleCookieRegion(request) : path.startsWith('/api/ai/') ? handleAi(request, env, context) : path.startsWith('/api/share/') || path.startsWith('/share/') ? handleShare(request, env, context) : path.startsWith('/art/') || path.startsWith('/edit/') ? handleCatalogPage(request, env, retired, catalogOptions) : retired.fetch(request, env); }};`,
    resolveDir: root,
    sourcefile: 'worker-entry.js',
  },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  outfile: join(dist, '_worker.js'),
});
const routes = JSON.parse(readFileSync(join(dist, '_routes.json'), 'utf8'));
if (routes.include.length + routes.exclude.length > 100)
  throw new Error('AI + retirement route count exceeds Pages limit');
const count = files(dist).length;
if (process.env.CF_PAGES === '1') assertPagesFileCount(count);
console.log(
  `CSP: ${hashes.size} exact script hashes. ${process.env.CF_PAGES === '1' ? 'Production' : 'Local'} build: ${count} files${process.env.CF_PAGES === '1' ? ` / ${PAGES_FILE_LIMIT.toLocaleString('en-US')} allowed` : ' (bundled development media included)'}.`,
);
