import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(
  realpathSync(new URL('../../node_modules/astro/package.json', import.meta.url)),
);
const { build } = require('esbuild');
export async function loadTypescript(path) {
  const result = await build({
    entryPoints: [path],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });
  return import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')
  );
}
