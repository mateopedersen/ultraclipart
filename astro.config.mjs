import { defineConfig } from 'astro/config';
import { realpathSync, cpSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readPublication } from './scripts/publication-policy.mjs';
import { releaseRevision } from './scripts/release-revision.mjs';
import { aiPreviewNotice } from './scripts/ai-preview.mjs';
import { checkSourceCatalog } from './scripts/seo/check-catalog.mjs';
import { preparePreviewAssets } from './scripts/preview-assets.mjs';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { buildSiteIcons, siteIconFiles } from './scripts/build-site-icons.mjs';

// Run even when CI or Pages invokes Astro directly instead of the package script.
checkSourceCatalog();
await buildSiteIcons();
await preparePreviewAssets(
  JSON.parse(readFileSync(new URL('./data/art.json', import.meta.url), 'utf8')),
);
import { productionPublicAssets } from './scripts/production-public-assets.mjs';

// The checked release, rather than a mutable dashboard value, selects production media.
const production = process.env.CF_PAGES === '1';
const publication = production ? readPublication(import.meta.dirname) : null;

export default defineConfig({
  site: 'https://ultraclipart.com',
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  build: { inlineStylesheets: 'always' },
  integrations: [
    productionPublicAssets(production),
    {
      name: 'ultraclipart-site-icons',
      hooks: {
        'astro:build:done': ({ dir }) => {
          for (const name of siteIconFiles)
            cpSync(new URL('./public/' + name, import.meta.url), new URL(name, dir));
        },
      },
    },
    {
      name: 'ultraclipart-catalog-image-seo',
      hooks: {
        // Keep the complete audit independent of Astro's large rendering heap.
        'astro:build:done': ({ dir }) =>
          new Promise((done, fail) => {
            const audit = spawn(
              process.execPath,
              [
                fileURLToPath(new URL('./scripts/seo/build-image-seo.mjs', import.meta.url)),
                fileURLToPath(dir),
              ],
              { cwd: fileURLToPath(new URL('.', import.meta.url)), stdio: 'inherit' },
            );
            audit.once('error', fail);
            audit.once('exit', (code) =>
              code === 0 ? done() : fail(new Error(`Image SEO gate failed (${code}).`)),
            );
          }),
      },
    },
    {
      name: 'ultraclipart-generated-screen-previews',
      hooks: {
        // Screenshot crops are generated during prerendering, after Vite copies
        // public/. Include them even on a clean CI checkout with no warm cache.
        'astro:build:done': ({ dir }) => {
          const source = new URL('./public/previews/ui/', import.meta.url);
          if (existsSync(source)) cpSync(source, new URL('previews/ui/', dir), { recursive: true });
        },
      },
    },
  ],
  vite: {
    plugins: [aiPreviewNotice()],
    server: {
      fs: {
        // This checkout reuses installed dependencies through a symlink.
        // Permit their real directory so font files load after a cache reset.
        allow: [
          fileURLToPath(new URL('.', import.meta.url)),
          realpathSync(new URL('./node_modules/', import.meta.url)),
        ],
      },
    },
    worker: { format: 'es' },
    define: {
      'import.meta.env.PUBLIC_RELEASE_REVISION': JSON.stringify(releaseRevision()),
      'import.meta.env.PUBLIC_ASSET_URLS': JSON.stringify(publication?.assetUrls ?? null),
    },
  },
});
