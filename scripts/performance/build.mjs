import { spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync, unlinkSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { activatePreview } from './release.mjs';

const root = resolve(import.meta.dirname, '../..');
const capacity = statfsSync(root);
const available = capacity.bavail * capacity.bsize;
if (available < 15 * 1024 ** 3)
  throw Error(
    'Local preview needs 15 GiB of free space. Retain the active release and baseline; remove unused generated HTML copies before rebuilding. Source files, originals and reports must be preserved.',
  );
const work = join(root, 'work');
mkdirSync(work, { recursive: true });
const lock = join(work, '.performance-build.lock');
let handle;
try {
  handle = openSync(lock, 'wx');
} catch (error) {
  if (error.code === 'EEXIST') throw Error('A local preview build is already running.');
  throw error;
}
writeFileSync(handle, String(process.pid));
const directory = join(work, 'performance-releases', `build-${Date.now()}-${process.pid}`);
try {
  const code = await new Promise((resolveCode, reject) => {
    const child = spawn(
      process.execPath,
      [
        join(root, 'node_modules/astro/bin/astro.mjs'),
        'build',
        '--config',
        'scripts/performance/astro.config.mjs',
      ],
      {
        cwd: root,
        stdio: 'inherit',
        env: { ...process.env, UC_PERFORMANCE_OUT_DIR: directory },
      },
    );
    child.once('error', reject);
    child.once('exit', (code) => resolveCode(code ?? 1));
  });
  if (code !== 0) throw Error(`Preview build failed (${code}); previous preview is unchanged.`);
  console.log(
    `Local preview activated: ${activatePreview(directory, join(work, 'performance-build'))}`,
  );
} finally {
  closeSync(handle);
  unlinkSync(lock);
}
