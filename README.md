# UltraClipart

An English-language Astro 7 and TypeScript clipart catalog, online editor and blank creation studio. Cloudflare Pages serves the application; immutable catalog media lives in R2 Standard. Inter is distributed under its open font license.

## Catalog and production records

`data/art.json` describes actual catalog artwork. `data/publication.json` binds every published representation to its exact byte count, SHA-256, immutable CDN URL, MIME type and verification evidence. Planned subjects are not presented as completed artwork.

The original plan is 110 topics with 50 generated illustrations per topic. `data/production-queue.json` records prepared catalog counts and remaining topic targets. Owner-supplied packages and the separate technology supplement are excluded from the 5,500 generated-artwork target. A prepared catalog row is not evidence that its deployment has passed live verification; retain the exact release revision and browser evidence when recording a completed publication.

## Development and checks

Use the Node and pnpm versions pinned in `package.json` and the workflow.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm dev
pnpm build
pnpm test
```

Check and build restore missing catalog media from the public CDN. Restoration verifies content type, size and SHA-256, confines writes to `public/`, and rejects changed local sources. Builds need no R2 write credentials. Browser checks in `tests/e2e/` cover responsive layouts, keyboard access, search, studio/editor operations and actual downloads.

The full unit suite and type checks run locally before publication and in GitHub Actions. The generated-artwork editor matrix selects all raster artwork belonging to the original topic plan, excluding supplied packages, then partitions every selected artwork once across three shards. Newly populated original topics enter coverage automatically. Supplied-package and supplemental-artwork suites remain separate.

## Artwork and exports

SVG sources retain editable vector layers. Raster sources retain one intact image layer; added text, shapes and other editor elements are separate editable layers. Moving, cropping, transforming, saving projects and editing added elements must not be described as independent vector editing of a flattened illustration.

Generated native WebP preserves the selected source RGBA pixels losslessly. Supplied originals retain their verified bytes. Standard PDF files must remain below 1,000,000 bytes. Raster print exports use real four-channel CMYK data and a registered GRACoL output condition; the full ICC profile is referenced rather than embedded. Each artwork exposes its actual print-page dimensions. Physical print proofs are distinct from screen-render checks.

Production plans and evidence live in `data/briefs/`, `data/research/`, `data/waves/` and ignored local staging directories. Review every selected master and rendered PDF, verify PDF/WebP pairing, check for exact and perceptual duplicates against the existing catalog, and inspect the final edited exports before publication. Source-only files and held variants do not count as finished artwork.

## R2 publication

Use the guarded uploader in `scripts/r2/`; see [the R2 runbook](docs/r2-ingestion.md). It measures the authorized account inventory, enforces the configured storage budget, uploads immutable content-addressed objects and reads every object back to verify its bytes. Public-CDN verification then checks the complete new representation set before creating a candidate manifest. Upload success alone does not grant editorial approval or prove live publication.

The source ZIPs, private working PNGs and credentials are not committed. PNG masters are not catalog downloads. Do not delete source archives or held repair evidence as part of publishing a replacement.

## Deployment

The public GitHub repository connects to the `ultraclipart` Cloudflare Pages project on `main`. The output directory is `dist`. Use this hosting build command:

```sh
pnpm build && pnpm test:release
```

The hosting release gate checks catalog identities, every declared asset representation, immutable publication mapping, generated output, CSP and retired-route isolation. It retains the existing full-byte verification. The full unit suite, type checks and browser suites remain in local publication and GitHub CI; repeating the entire suite inside the hosting container previously exhausted its build time limit after all tests had passed.

Keep `NODE_VERSION`, `PNPM_VERSION` and telemetry settings aligned with the repository. Cloudflare sets `CF_PAGES=1`, which selects verified immutable CDN URLs. Keep `PAGES_WRANGLER_MAJOR_VERSION=4` aligned with the account's supported file ceiling. The build validates actual output count and route limits. Never infer a paid plan or raise limits by changing the validation constant.

For an authorized manual publication:

```sh
pnpm deploy
```

This restores and verifies assets, runs type checks, rebuilds production output, verifies any R2-hosted catalog pages, checks headers and runs the full unit suite before uploading. It does not publish a stale existing `dist/` folder. Keep the resulting deployment bound to its exact Git revision and test the apex-domain release afterward.

The application also uses narrowly scoped Pages Functions for unavailable routes, project sharing, guarded generation endpoints and selected R2-hosted catalog pages. Bindings and explicit server quotas are declared in `wrangler.jsonc`; no client receives account credentials.

## License and public content

Artwork is free for personal and educational use. Commercial use and resale as clipart are prohibited. Contact: ultraclipart@gmail.com.

Public titles, ALT text, structured data and counts must describe the actual image and available files. Preserve working canonical URLs when replacing artwork. Do not invent artist identities, reviews, licenses, search rankings, advertising acceptance or human/physical-print approval. Production annotations belong in repository evidence, not in the artwork or public gallery.
