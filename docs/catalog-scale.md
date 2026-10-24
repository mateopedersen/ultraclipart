# Catalog capacity and migration

UltraClipart upgraded to Cloudflare Pro on 2026-10-24. The project's upload-token
claim `max_file_count_allowed` was verified as 100,000 through the Cloudflare API.
The production project has `PAGES_WRANGLER_MAJOR_VERSION=4`; the manual deployment
also sets it explicitly. Production build checks now enforce the verified
100,000-file ceiling instead of the old Free ceiling of 20,000.

The current release contains 6,200 illustrations and 19,396 Pages files before
offloading (19,296 after Book offloading). Each illustration currently generates
a detail page and an editor page, plus search data. The 100,000-file limit is per
Pages project, not 100,000 illustrations. It does not make a five-million-item
catalog viable if one HTML file per item remains in the Pages deployment.

## First production stage: private HTML storage

The Book collection is a controlled migration. During a manual production
deployment, Astro renders both pages for each of its 50 reviewed items.
`scripts/catalog-pages/upload.mjs` uploads the 100 HTML files to the private
`ultraclipart-pages` R2 bucket under the release commit SHA, then downloads
each file to verify its SHA-256.
Only then does `scripts/catalog-pages/prune.mjs` remove those exact files from
the Pages bundle. The existing Pages Worker serves them from R2 at their
original `/art/{id}/` and `/edit/{id}/` URLs. Static artwork outside Book still
uses the old path. Missing and withdrawn items retain real 404 responses.

The offload manifest is intentionally local to the deployment. Every manual
deployment uploads the freshly rendered HTML to a new release prefix; the old
live Worker keeps reading the previous prefix until the new Pages deployment
activates. A failed deployment cannot change its live pages. Git-connected
builds do not set `CATALOG_OFFLOAD_COLLECTION`; they keep static fallback pages.
The manual deploy must finish after a Git-driven build.

## Next stages for 100,000 to 5,000,000 items

1. Split `data/art.json` and the search index into independently published
   batches. A single multi-million-record JSON import would overwhelm the
   build and Worker bundle even if HTML were moved to R2.
2. Store per-item metadata in indexed database shards, keep WebP/PDF masters
   in R2, and render or publish only the changed detail/editor pages per batch.
   Maintain a checked publication manifest and atomic activation pointer.
3. Move category listings, search, discovery, and the new-art feed to paginated
   data queries. Keep page-one HTML crawlable and cache common queries.
4. Generate a sitemap index with child sitemaps capped at 50,000 URLs, update
   only affected children, and preserve canonical URLs and structured data.
5. Add deletion/withdrawal propagation, performance budgets, and traffic-based
   Workers/R2 cost monitoring before broad routing is switched on.

The Book offload is the first working stage, not a claim that the remaining
static catalog can already hold five million entries. The site must complete
stages 1–5 before that target is supportable.
