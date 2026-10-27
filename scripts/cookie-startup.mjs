import { buildSync } from 'esbuild';
import { resolve } from 'node:path';
// Build once per module load, not once per prerendered route. The existing release
// CSP generator hashes this same inline script without relaxing script-src.
const bundle = (entry) =>
  buildSync({
    // Astro relocates server modules into .prerender; build entry paths remain
    // relative to the project root, just like astro.config.mjs and build scripts.
    entryPoints: [resolve(entry)],
    bundle: true,
    write: false,
    minify: true,
    format: 'iife',
    target: 'es2020',
  }).outputFiles[0].text;
export const cookieStartupScript = bundle('src/scripts/cookie-startup.ts');
export const cookieMountScript = bundle('src/scripts/cookie-mount.ts');
