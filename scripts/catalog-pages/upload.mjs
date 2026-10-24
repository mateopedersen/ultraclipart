import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { releaseRevision } from '../release-revision.mjs';

const root = resolve(import.meta.dirname, '../..');
const collection = process.argv[2];
const expected = Number(process.argv[3]);
if (!/^owner-[a-z0-9-]+$/.test(collection ?? '') || !Number.isInteger(expected) || expected < 1)
  throw Error('Usage: node scripts/catalog-pages/upload.mjs owner-collection-id expected-count');
const art = JSON.parse(readFileSync(join(root, 'data/art.json'), 'utf8'));
const items = art.filter((item) => item.sourceCollection === collection);
if (items.length !== expected) throw Error(`Expected ${expected} items, found ${items.length}`);
const revision = releaseRevision();
if (revision === 'local') throw Error('Catalog HTML upload requires a production revision');
const bucket = 'ultraclipart-pages';
const work = join(root, 'work/catalog-pages', collection, revision);
mkdirSync(work, { recursive: true });
const sha = (data) => createHash('sha256').update(data).digest('hex');
const htmlEscape = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
const pages = items.flatMap((item) =>
  ['art', 'edit'].map((kind) => {
    const path = join(root, 'dist', kind, item.id, 'index.html');
    if (!existsSync(path)) throw Error(`Missing rendered ${kind} page for ${item.id}`);
    const bytes = readFileSync(path);
    const html = bytes.toString('utf8');
    if (!html.includes(`https://ultraclipart.com/${kind}/${item.id}/`))
      throw Error(`Wrong canonical URL in ${path}`);
    if (kind === 'art' && !html.includes(htmlEscape(item.title)))
      throw Error(`Missing title in ${path}`);
    if (kind === 'edit' && !html.includes('noindex,follow'))
      throw Error(`Editor unexpectedly indexable: ${path}`);
    return {
      id: item.id,
      kind,
      key: `html/${revision}/${kind}/${item.id}/index.html`,
      path,
      bytes: bytes.length,
      sha256: sha(bytes),
    };
  }),
);

const bin = join(root, 'node_modules/wrangler/bin/wrangler.js');
function wrangler(args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd: root, env: process.env });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolveRun(output)
        : reject(Error(`Wrangler ${args.slice(0, 3).join(' ')} failed: ${output.slice(-1200)}`)),
    );
  });
}

// Refresh OAuth before parallel object operations; a stale token otherwise
// makes several uploads fail at once and leaves an incomplete staging prefix.
await wrangler(['whoami']);
let next = 0;
let verified = 0;
async function worker() {
  while (next < pages.length) {
    const page = pages[next++];
    const identity = `${bucket}/${page.key}`;
    await wrangler([
      'r2',
      'object',
      'put',
      identity,
      '--file',
      page.path,
      '--remote',
      '--content-type',
      'text/html; charset=utf-8',
    ]);
    const download = join(work, `${page.kind}-${page.id}.html`);
    await wrangler(['r2', 'object', 'get', identity, '--file', download, '--remote']);
    const actual = readFileSync(download);
    if (actual.length !== page.bytes || sha(actual) !== page.sha256)
      throw Error(`Remote HTML differs: ${page.key}`);
    verified++;
    if (verified % 10 === 0 || verified === pages.length)
      console.log(`Verified ${verified}/${pages.length} catalog pages`);
  }
}
await Promise.all(Array.from({ length: Math.min(4, pages.length) }, worker));
const manifest = {
  schema: 1,
  status: 'verified',
  collection,
  revision,
  bucket,
  count: items.length,
  pageCount: pages.length,
  pages: pages.map(({ path, ...entry }) => entry),
};
writeFileSync(join(work, 'verified-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Remote catalog pages verified: ${pages.length}`);
