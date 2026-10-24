import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { readPublication } from './publication-policy.mjs';
import { retirementPolicy, createRetiredHandler } from './retired-routes.mjs';
import { pruneCatalogOutput } from './prune-catalog-output.mjs';

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
const searchVersion = JSON.parse(
  readFileSync(join(dist, 'search-data/manifest.json'), 'utf8'),
).version;
writeFileSync(
  join(dist, '_headers'),
  `${csp}\n/search-data/${searchVersion}/*\n  Cache-Control: public, max-age=31536000, immutable\n/search-data/manifest.json\n  Cache-Control: no-cache\n`,
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
  // A locally staged next wave must not leak into a manual production build.
  // Sources and unrelated UI assets, including the blank studio, stay intact.
  pruneCatalogOutput(dist);
  for (const path of publication.localPaths) rmSync(join(dist, path.slice(1)), { force: true });
  console.log(`CDN release: ${publication.files} verified files, ${publication.bytes} bytes.`);
}
const retirement = retirementPolicy(
  [
    ...JSON.parse(readFileSync(join(root, 'data/topics.json'), 'utf8')).topics,
    ...JSON.parse(readFileSync(join(root, 'data/extra-topics.json'), 'utf8')),
  ],
  JSON.parse(readFileSync(join(root, 'data/art.json'), 'utf8')),
  JSON.parse(readFileSync(join(root, 'data/retired-artwork.json'), 'utf8')),
  files(dist).map((path) => '/' + relative(dist, path)),
);
if (retirement) {
  const responseHeaders = Object.fromEntries(
    [...csp.split('/_astro/*')[0].matchAll(/^  ([\w-]+): (.+)$/gm)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  writeFileSync(join(dist, '_routes.json'), JSON.stringify(retirement.routes));
  writeFileSync(
    join(dist, '_worker.js'),
    `export default (${createRetiredHandler.toString()})(${JSON.stringify(retirement.retired)}, ${JSON.stringify(responseHeaders)});\n`,
  );
  console.log(
    `Unavailable routes: ${retirement.retired.length}; live collections/assets bypass the 404 function.`,
  );
} else {
  for (const name of ['_routes.json', '_worker.js']) rmSync(join(dist, name), { force: true });
}
const count = files(dist).length;
if (process.env.CF_PAGES === '1' && count > 20_000)
  throw new Error(`Pages Free file limit exceeded: ${count} files.`);
console.log(
  `CSP: ${hashes.size} exact script hashes. ${process.env.CF_PAGES === '1' ? 'Production' : 'Local'} build: ${count} files${process.env.CF_PAGES === '1' ? ' / 20,000 allowed' : ' (bundled development media included)'}.`,
);
