# Verified implementation references

Checked 23 October 2026. These are public product limits and implementation guidance, not evidence that this account has enabled a product or that a production deployment has passed a test.

## Framework

- Astro **7.4.2** is the stable npm `latest` version observed. Its published engine requirement is Node **>=22.23.4**, npm >=9.6.5. Pin the installed version and lock transitive dependencies. [Official package metadata](https://registry.npmjs.org/astro/latest)
- Astro 7.4 was announced 15 October 2026; it supports build timing reports and optional parallel prerendering. Its announcement lists an older minimum Node patch than the subsequently published 7.4.2 package; the installed package engine requirement takes precedence. [Astro release announcement](https://astro.build/blog/astro-740/)

## Cloudflare

| Product | Verified allowance or constraint | Implementation consequence |
|---|---|---|
| R2 Standard | 10 GB-month storage, 1 million Class A operations, 10 million Class B operations included per month; free internet egress | Track operations and bytes separately. Free storage is not a hard billing cap. |
| Workers Free | 100,000 dynamic requests/day, 10 ms CPU/request | Generate public pages statically and edit/export in the browser. |
| Workers Static Assets | 20,000 files/version; 25 MiB/file on Free | Count the complete deployment output, including media when using a pilot fallback. |
| D1 Free | 5 million rows read/day, 100,000 written/day, 5 GB total; 500 MB/database | D1 is optional; no public page needs a database request. |

Sources: [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

R2 requires an R2 subscription and checkout flow. Owner approval is needed before activating a new metered subscription. [R2 setup](https://developers.cloudflare.com/r2/get-started/)

Static asset requests are ordinarily free and unlimited; enabling the separate Workers Caching feature changes request billing behavior. Do not infer a universal zero-cost guarantee. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

Use a custom R2 domain for production cache delivery. Configure narrowly scoped origins for browser access and immutable, content-hashed object keys. `r2.dev` is for development. [Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/), [CORS](https://developers.cloudflare.com/r2/buckets/cors/). GitHub integration can trigger Workers Builds from repository pushes. [GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)

## Search and editorial policy

Serve useful HTML with real image elements, descriptive filenames, accurate alt text and known intrinsic dimensions. Google supports WebP and SVG in image `src` attributes. [Image SEO](https://developers.google.com/search/docs/appearance/google-images)

Keep each sitemap below 50,000 URLs and 50 MB uncompressed; list canonical, indexable pages. The implementation excludes empty topic pages and internal search from the sitemap. Image sitemap URLs can identify actual CDN resources. [Sitemap rules](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Image sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps)

ImageObject metadata must match the visible artwork. License and creator properties are omitted when unknown. A generic ImageObject does not establish eligibility for Google's licensable badge; that feature has additional requirements. [Image licensing metadata](https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata)

E-E-A-T is not a discrete ranking score. Describe real provenance, review and contact information; do not invent artists, endorsements or qualifications. [Helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)

Generating many pages primarily to manipulate rankings is scaled content abuse. Preserve the exact 110-topic backlog while keeping unpopulated topics clearly unfinished and out of the index. [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies)

## Project-specific storage policy

The owner updated the account ingestion ceiling to **10,000,000,000,000 bytes (10 TB)** on 2026-10-24 after resolving billing. This supersedes the previous 8 GB project rule. Fresh account-wide inventory remains required. Storage review warnings begin at 8 TB and approaching-cap warnings at 9.5 TB; only crossing 10 TB blocks ingestion. The independent standard PDF hard cap remains **1,000,000 bytes**.
