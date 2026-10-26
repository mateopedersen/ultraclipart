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
// Keep a manual build's HTML and compiled assets in one Pages deployment.
// R2 HTML offload is a separate migration and must not be inherited here.
delete env.CATALOG_OFFLOAD_COLLECTION;
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
run('scripts/verify-social-images.mjs');
run('node_modules/astro/bin/astro.mjs', ['check']);
run('node_modules/astro/bin/astro.mjs', ['build']);
// Every artwork/editor HTML file remains with this build's asset bundle.
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
