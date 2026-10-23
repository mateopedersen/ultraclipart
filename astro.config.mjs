import { defineConfig } from 'astro/config';
import { readPublication } from './scripts/publication-policy.mjs';

// The checked release, rather than a mutable dashboard value, selects production media.
const production = process.env.CF_PAGES === '1';
const publication = production ? readPublication(import.meta.dirname) : null;

export default defineConfig({
  site: 'https://ultraclipart.com',
  output: 'static',
  trailingSlash: 'always',
  vite: {
    worker: { format: 'es' },
    define: {
      'import.meta.env.PUBLIC_RELEASE_REVISION': JSON.stringify(
        process.env.CF_PAGES_COMMIT_SHA ?? 'local',
      ),
      'import.meta.env.PUBLIC_ASSET_URLS': JSON.stringify(publication?.assetUrls ?? null),
    },
  },
});
