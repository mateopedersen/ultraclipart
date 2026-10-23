# Release acceptance checklist

Source: owner request and handoff documents 04, 06, 07, 08, 09; framework/service facts independently verified in `research.md`. This checklist records requirements, **not completed results**. Evidence must identify the tested build and environment.

## Data and illustration

- Preserve all 110 original keyword names, IDs, slugs, clusters and wave assignments; target 50 different approved originals/topic and 5,500 overall.
- Count real approved IDs only. Distinguish drafted, technically validated, visually reviewed, published and complete states.
- Every approved artwork has a layered editable SVG, transparent WebP, thumbnail and genuine CMYK PDF; each standard PDF <=1,000,000 bytes.
- Reject scripts, event handlers, external references, `foreignObject` and unsafe URLs in imported SVG. Do not load arbitrary remote fonts/images into export.
- Record briefs, provenance, file sizes, hashes, dimensions and technical review results. Hash uniqueness alone is not artistic originality review.
- Separate overlapping subjects and traditions accurately; do not clone galleries to fill keywords. Keep 2027 artwork year-specific and Turkey artwork about the bird.
- Human-quality visual review includes white/dark backgrounds, line work, edge halos, crop and print proof. Whole-art recolors are variants, not new originals.

## UI and editor

- Reproduce all ten reference workflows with responsive purple/blue UltraClipart styling, folded-U brand, English interface and legally distributable typography.
- Working header/search/category/A-Z/topic/card/detail/editor/B&W/export routes, accessible navigation and a genuine 404.
- Search filters, sorts, pagination and URL history; clear empty result state; actual counts; local favorites persist.
- Layer select/move/resize/rotate/reorder/show/hide/lock/duplicate/delete; object recolor; background controls; undo/redo; zoom and keyboard commands.
- WebP and CMYK PDF exports must reflect the edited document; paper size/orientation/margins/background choices affect actual bytes. Never silently return the original download after editing.
- Mobile 320/390px, tablet 768px, laptop 1024px, desktop 1440px; modal focus trap/escape/return; no keyboard-inaccessible controls.
- Browser export remains functional offline once its assets and code are loaded, or returns a useful failure explanation.

## SEO and trust

- Unique meaningful title, description, one main H1, absolute canonical, `lang=en`, accurate Open Graph/Twitter metadata.
- Canonical apex HTTPS with consistent trailing slash; redirect alternate host; real 200/301/404 statuses.
- Draft/empty topics and internal search are noindex and excluded from sitemaps. Qualified art details and populated topic pages contain useful prerendered HTML.
- Correct alt text, intrinsic dimensions and real image URLs; structured data never invents licenses, creators, ratings or counts.
- Sitemap index + image URLs, valid XML, honest lastmod, only live canonical indexable entries; robots allows useful media/HTML.
- About, process, contact, FAQ, license, terms, privacy, copyright and accessibility pages; contact must be actually routed to an owner-approved channel.
- No invented commercial-use/public-domain grant. Legal terms require an owner decision before claims of an approved license. No fake social links or Google ranking promises.

## Storage, release and security

- New public GitHub repository only; do not alter existing calendar repositories. Store source/metadata, not full generated binary corpus or proprietary font files.
- Locked dependencies, supported Node, reproducible clean install/build; CI checks before production.
- Cloudflare Pages Free static hosting with GitHub integration; optional dynamic services only when necessary. Owner approval before R2 checkout, paid products, upgrades or paid APIs.
- R2 Standard, aggregate measured storage across production buckets; fail closed on unknown totals; preflight next batch against 8,000,000,000 bytes.
- Content hashes, narrowly scoped credentials, cache headers, CORS, MIME, download filename; resumable upload journal with verified checksums. Publish only complete validated art groups.
- No tokens, cookies, private user uploads or Avenir binaries in repository, browser bundles or logs. CSP and hostile SVG tests.
- Check output file count <20,000 and each static file <=25 MiB. Track Class A/B operations, Pages build usage and storage; storage guard does not prevent read-overage charges.

## Required test evidence

- Exact keyword parity; unique IDs/slugs/files; asset pairing and hashes; byte budgets and unknown-occupancy fail-closed tests.
- SVG attack tests; editor command/undo invariants; search parsing/facets; draft exclusion.
- CMYK preflight with content/operator and color-profile evidence, vector preservation and rendered comparison to source; WebP decode/alpha/dimensions.
- Chromium, Firefox, WebKit flows with downloads and edits; axe + manual keyboard; real-mobile verification if a device is available.
- Crawl built and live routes for links, images, canonicals, schema, sitemaps, robots, status codes and mixed content.
- Lighthouse or equivalent lab measurements, with field Core Web Vitals clearly distinguished; LCP <=2.5s, INP <=200ms, CLS <=0.1 targets.
- Post-deploy smoke tests on each page type and a topic from each populated cluster; release SHA, Cloudflare build, custom-domain TLS, CDN byte/hash/CORS verification.

## Handover must report observed values

Repository, branch/commit, CI/build URLs; verified live homepage and each page-type URL; actual topic/art/file counts; R2 objects/bytes and subscription state; PDF maximum and CMYK preflight results; browser/accessibility/performance/security evidence; unresolved defects, owner-only blockers and exact resume commands. Local pass is not production pass. Missing art is not completed art.
