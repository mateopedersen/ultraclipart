# UltraClipart

An English-language, static-first Astro 7.4.2 clipart catalog with a layered SVG browser editor, transparent WebP downloads, and process-CMYK vector PDF exports. TypeScript, small browser modules, Inter, and Cloudflare Pages keep the application lightweight.

**This checkout contains an honest pilot: 10 original illustrations across 9 topics.** The supplied taxonomy includes all 110 topics. The production target is 50 distinct, reviewed illustrations per topic: 5,500 total, with **5,490 still undrawn** and no completed 50-art topic. Planning rows and recolor presets are never counted as drawings. Pilot catalog pages remain separate from approved production content and are not submitted for indexing as a completed library.

## Run locally

Use Node.js 24 and pnpm 11.25.0. The package's minimum Node version is 22.23.4.

```sh
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Astro. Main commands:

```sh
pnpm check
pnpm build
pnpm test
pnpm exec astro preview
```

`pnpm test` checks keyword parity, real file signatures and hashes, search, editor document behavior, SEO output, and R2 budgeting/ingestion logic. Build before running tests that inspect generated HTML. Browser checks are separate from unit checks:

```sh
pnpm exec playwright install chromium
# With the development or preview server running:
BASE_URL=http://127.0.0.1:4321 node tests/e2e/search.mjs
BASE_URL=http://127.0.0.1:4321 node tests/e2e/site.mjs
BASE_URL=http://127.0.0.1:4321 node tests/e2e/refinement.mjs
```

Set `BASE_URL` to the actual server address. Browser evidence is generated under `reports/`. A local passing result does not prove a deployed domain works.

The full-site browser suite checks all ten reference workflows at desktop, tablet and mobile sizes, accessibility scans, category filtering, favorites, dialog keyboard behavior and informational routes. It defaults to Chromium; set `TEST_BROWSER=firefox` or `TEST_BROWSER=webkit` after installing that Playwright browser. `.github/workflows/ci.yml` runs locked installation, type checks, build, tests and Chromium, Firefox and WebKit browser/editor checks on pull requests and pushes to `main`.

## Creative Studio

`/create/` is a local browser workspace. It starts from a blank canvas or one of six editable studio templates. The templates are separate from catalog production counts. Users can combine eight parameterized shapes, draw smooth vector strokes, add text, resize the canvas, import supported SVGs, manage named layers, save an editable project, and export transparent WebP or process-CMYK vector PDF. Existing transform, grouping, crop, print-layout and undo tools share the same document model as the catalog editor.

SVG imports use an explicit vector-element and attribute allowlist, finite geometry limits, and document/layer/path bounds. External resources, scripts and unsupported rendering features are rejected. Project recovery stays in browser storage; users should save a project file for a separate copy. The site does not upload user artwork or call a paid image API. Original user work remains theirs; UltraClipart starter templates follow the site's personal and educational use license.

The creator suite exercises blank and template workflows, drawing cancellation, shape controls, imports, undo, exports and responsive accessibility:

```sh
UC_BASE_URL=http://127.0.0.1:4321 UC_BROWSER=chromium node tests/e2e/creator.mjs
```

## Art production and resuming

The ten pilot illustrations are original AI-assisted, code-drawn vectors with named editable groups. There is no stock artwork or screenshot tracing. The checked-in small pilot is for development and review; a full catalog belongs in R2, not Git. Revision 2 improves all ten existing works without inflating the drawing count: 107 named editable layers, with composition and material details recorded in `data/art-revision-history.json`.

Install Python 3.12+, create a virtual environment, and install the pinned art dependencies. Poppler's `pdftoppm` is needed only for screen proofs.

```sh
python3 -m venv .venv-art
.venv-art/bin/python -m pip install -r scripts/requirements-art.txt
.venv-art/bin/python scripts/art-create.py
.venv-art/bin/python scripts/art-export.py
.venv-art/bin/python scripts/art-preflight.py
.venv-art/bin/python scripts/art-plan.py
.venv-art/bin/python scripts/art-proofs.py
```

These commands rebuild the existing pilot; they do not invent another 5,490 finished drawings. `data/production-queue.json` records actual generated assets, pending reviews, and all topic targets. `data/briefs/` contains 450 **draft** concept rows for the nine represented topics. Review and refine briefs before drawing the next minibatch. The initial pilot preceded the full draft briefs; that limitation is recorded rather than hidden.

See [the reproducible art pipeline](scripts/ART-PIPELINE.txt) for optional executable overrides and file locations. `data/art-preflight.json` records structural and file checks. `data/art-visual-review.json` records an **AI-agent screen review**, not human or physical-print approval.

Original downloads use lossless 2048 × 2048 WebP with alpha. PDFs contain actual CMYK vector painting operations. LittleCMS converts sRGB to GRACoL2006_Coated1v2; exact neutral colors preserve pure K. PDFs identify the registered print condition, while the full ICC profile is referenced rather than embedded because its size exceeds the 1,000,000-byte PDF cap. The licensed profile and terms are in `public/color/`. No PDF/X certification or universal printer/paper color match is claimed. Browser edited exports use the same sampled color transform, subject to their recorded fidelity tests.

Latest original pilot preflight: 40 representations totaling 1,013,178 local bytes; maximum/P95 PDF 6,349 bytes; zero PDFs above the cap. These are local measurements, not R2 usage.

## R2 and deployment

[scripts/r2](scripts/r2/) is the supported automated R2 ingestion path. The small initial pilot and its revised immutable snapshot were uploaded through the authorized Cloudflare dashboard and then checked byte-for-byte through the public CDN; automated waves must use the guarded uploader. Read the [R2 runbook](docs/r2-ingestion.md) before use. It requires an owner-authorized, activated R2 Standard account, an existing bucket, AWS CLI, privately supplied credentials, and full-account inventory access. It does not activate subscriptions or configure billing.

```sh
node scripts/r2/make-batch.mjs BUCKET --pilot --output work/r2-batch.json
node scripts/r2/ingest.mjs work/r2-batch.json
# After reviewing the measured inventory and batch:
node scripts/r2/ingest.mjs work/r2-batch.json --apply
```

The first command only writes a local batch; the second reads remote inventory without uploading. `--pilot` explicitly selects unapproved preview assets and does not grant publication approval. The uploader verifies remote SHA-256 values, checkpoints completed file groups, resumes the same batch, and enforces the aggregate 8 GB ingestion stop. It cannot cap externally generated request charges or coordinate unrelated uploaders. Never commit credentials or journals.

Connect this repository to a new Cloudflare Pages project named `ultraclipart`, using the repository root and production branch `main`. Set the build command to `pnpm check && pnpm build && pnpm test` and the output directory to `dist`. Pages publishes the successful build automatically; its Git integration does not need a separate deploy command or a new account-wide API token.

Set build variables `NODE_VERSION=24.19.0`, `PNPM_VERSION=11.25.0`, and `ASTRO_TELEMETRY_DISABLED=1`. Cloudflare sets `CF_PAGES=1`: production then reads `data/publication.json`, checks every catalog file against the verified CDN snapshot and compiles each verified immutable file URL into HTML and search data. A missing, incomplete or changed release fails the build. A dashboard `PUBLIC_ASSET_BASE` cannot override this release record. Local and CI builds use the bundled pilot. No Pages Functions or runtime R2/D1 bindings are required.

For an optional manual deployment using an already authorized local Cloudflare session (the command rebuilds in production mode and requires publication, type, build and unit-test gates before uploading):

```sh
pnpm deploy
```

Production output excludes duplicate pilot files only after confirming that every reference uses the verified CDN. Content-addressed search shards receive immutable cache headers; the small manifest revalidates. An exact post-build file-count guard enforces the 20,000-file Pages Free limit. The 5,500-item synthetic search fixture currently projects 17,720 files and downloads 9,589 bytes of JSON for a cold eight-result browse; this is a scale test, not a claim that 5,500 drawings exist. See [search architecture](docs/SEARCH-ARCHITECTURE.txt).

`wrangler.jsonc` declares the Pages project and `pages_build_output_dir: "./dist"`. The build generates the exact inline-script CSP hashes in `dist/_headers`, and `dist/404.html` provides the missing-page response. Custom-domain DNS, R2 activation, account metrics, and live smoke-test evidence must be verified in the actual accounts; configuration files and this README are not proof of a successful deployment. Current verified deployment status belongs in the delivery report. See the official [Astro deployment guide](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/), [Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/), and [build version settings](https://developers.cloudflare.com/pages/configuration/build-image/).

After deployment, read-only smoke checks compare all built routes and their resources with the live site, and the complete pilot CDN files with the verified local hashes. The CDN check reads the verified per-file publication map:

```sh
BASE_URL=https://ultraclipart.com node scripts/smoke-live.mjs
node scripts/smoke-cdn.mjs
BASE_URL=https://ultraclipart.com node tests/e2e/site.mjs
```

HTTP and CDN results are saved in `reports/live/`. A passing HTTP check does not replace browser execution under the deployed security policy. `scripts/audit-performance.mjs` records lab LCP/CLS, build sizes and configured versus observed headers; it does not measure field Core Web Vitals or claim INP.

## Rights, review, and remaining work

The owner approved **free personal and educational use**; commercial use and resale as clipart are prohibited. Contact: [ultraclipart@gmail.com](mailto:ultraclipart@gmail.com). This policy is not a human art-quality signoff. Inter is bundled under its open font license; no proprietary Avenir webfont is distributed.

Remaining work includes the 5,490 undrawn designs, review and production publication gates, source-informed cultural/religious artwork review, physical print proofing, and any browser/device or live-account checks not backed by saved evidence. No Search Console verification, traffic, ranking, artist credential, review, or storage total is fabricated.

Further implementation decisions and official-source research: [requirements](docs/requirements.md), [research](docs/research.md).
