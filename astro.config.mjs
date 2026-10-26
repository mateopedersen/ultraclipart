import { defineConfig } from 'astro/config';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readPublication } from './scripts/publication-policy.mjs';
import { releaseRevision } from './scripts/release-revision.mjs';
import { aiPreviewNotice } from './scripts/ai-preview.mjs';
import { productionPublicAssets } from './scripts/production-public-assets.mjs';

// The checked release, rather than a mutable dashboard value, selects production media.
const production = process.env.CF_PAGES === '1';
const publication = production ? readPublication(import.meta.dirname) : null;

export default defineConfig({
  site: 'https://ultraclipart.com',
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  integrations: [productionPublicAssets(production)],
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
