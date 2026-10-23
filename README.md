# UltraClipart

An English-language, static-first Astro 7.4.2 clipart catalog with a layered SVG browser editor, transparent WebP downloads, and process-CMYK vector PDF exports. TypeScript, small browser modules, Inter, and Cloudflare Workers Static Assets keep the application lightweight.

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
pnpm preview
```

`pnpm test` checks keyword parity, real file signatures and hashes, search, editor document behavior, SEO output, and R2 budgeting/ingestion logic. Build before running tests that inspect generated HTML. Browser checks are separate from unit checks:

```sh
pnpm exec playwright install chromium
# With the development or preview server running:
BASE_URL=http://127.0.0.1:4321 node tests/e2e/search.mjs
BASE_URL=http://127.0.0.1:4321 node tests/e2e/site.mjs
```

Set `BASE_URL` to the actual server address. Browser evidence is generated under `reports/`. A local passing result does not prove a deployed domain works.

The full-site browser suite checks all ten reference workflows at desktop, tablet and mobile sizes, accessibility scans, category filtering, favorites, dialog keyboard behavior and informational routes. It defaults to Chromium; set `TEST_BROWSER=firefox` or `TEST_BROWSER=webkit` after installing that Playwright browser. `.github/workflows/ci.yml` runs locked installation, type checks, build, tests and Chromium browser checks on pull requests and pushes to `main`.

## Art production and resuming

The ten pilot illustrations are original AI-assisted, code-drawn vectors with named editable groups. There is no stock artwork or screenshot tracing. The checked-in small pilot is for development and review; a full catalog belongs in R2, not Git.

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

Latest original pilot preflight: 40 representations totaling 734,901 local bytes; maximum/P95 PDF 4,007 bytes; zero PDFs above the cap. These are local measurements, not R2 usage.

## R2 and deployment

[scripts/r2](scripts/r2/) is the only supported R2 ingestion path. Read the [R2 runbook](docs/r2-ingestion.md) before use. It requires an owner-authorized, activated R2 Standard account, an existing bucket, AWS CLI, privately supplied credentials, and full-account inventory access. It does not activate subscriptions or configure billing.

```sh
node scripts/r2/make-batch.mjs BUCKET --pilot --output work/r2-batch.json
node scripts/r2/ingest.mjs work/r2-batch.json
# After reviewing the measured inventory and batch:
node scripts/r2/ingest.mjs work/r2-batch.json --apply
```

The first command only writes a local batch; the second reads remote inventory without uploading. `--pilot` explicitly selects unapproved preview assets and does not grant publication approval. The uploader verifies remote SHA-256 values, checkpoints completed file groups, resumes the same batch, and enforces the aggregate 8 GB ingestion stop. It cannot cap externally generated request charges or coordinate unrelated uploaders. Never commit credentials or journals.

After a passing build and authenticated, authorized Cloudflare setup:

```sh
pnpm build
pnpm deploy
```

`wrangler.jsonc` configures Workers Static Assets from `dist/`. GitHub-to-Cloudflare automation also needs account integration or correctly scoped deployment secrets. Custom-domain DNS, R2 activation, account metrics, and live smoke-test evidence must be verified in the actual accounts; configuration files and this README are not proof of a successful deployment. Current verified deployment status belongs in the delivery report.

## Rights, review, and remaining work

The owner approved **free personal and educational use**; commercial use and resale as clipart are prohibited. Contact: [ultraclipart@gmail.com](mailto:ultraclipart@gmail.com). This policy is not a human art-quality signoff. Inter is bundled under its open font license; no proprietary Avenir webfont is distributed.

Remaining work includes the 5,490 undrawn designs, review and production publication gates, source-informed cultural/religious artwork review, physical print proofing, and any browser/device or live-account checks not backed by saved evidence. No Search Console verification, traffic, ranking, artist credential, review, or storage total is fabricated.

Further implementation decisions and official-source research: [requirements](docs/requirements.md), [research](docs/research.md).
