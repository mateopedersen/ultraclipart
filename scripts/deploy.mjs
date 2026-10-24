import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { readPublication } from './publication-policy.mjs';

const root = resolve(import.meta.dirname, '..');
const env = {
  ...process.env,
  CF_PAGES: '1',
  ASTRO_TELEMETRY_DISABLED: '1',
  PAGES_WRANGLER_MAJOR_VERSION: '4',
};
function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Manual publication has the same gates as Git-driven publication. Never deploy
// a previously generated local dist: it may contain stale or unverified media.
run('scripts/restore-assets.mjs');
readPublication(root);
run('node_modules/astro/bin/astro.mjs', ['check']);
run('node_modules/astro/bin/astro.mjs', ['build']);
// HTML leaves Pages only after each page is uploaded and read back from R2.
const catalogCollection = 'owner-book-pack-2026-10-24';
run('scripts/catalog-pages/upload.mjs', [catalogCollection, '50']);
env.CATALOG_OFFLOAD_COLLECTION = catalogCollection;
run('scripts/security-headers.mjs');
run(
  '--test',
  readdirSync(resolve(root, 'tests'))
    .filter((name) => name.endsWith('.mjs'))
    .map((name) => `tests/${name}`),
);
run('node_modules/wrangler/bin/wrangler.js', [
  'pages',
  'deploy',
  'dist',
  '--project-name',
  'ultraclipart',
  '--branch',
  'main',
]);
