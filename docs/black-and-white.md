# Black & White library

## Automatic membership

`catalog.ts` runs `auditMonochrome` over published, indexable records. The audit reads each approved local thumbnail before media URLs are rewritten to their published CDN equivalents. Thumbnail SHA-256 must match the catalog. It measures visible pixels in sRGB and ignores transparent pixels. Compression noise and subtle neutral paper tints are tolerated; colored outlines and visible color accents fail the monochrome rule. This is conservative pixel classification, not a semantic claim that a black animal is monochrome.

The result supplies `monochrome` and `monochromeKind` on catalog records. `blackAndWhiteArt`, public printable totals, build-time search results and the remote search monochrome facet use the same result. A neutral original can qualify even when its old style metadata says Color. A colored drawing cannot qualify solely because its style says Outline or because it can be edited.

Every normal dev catalog reload and every static build applies the rule to new/revised records. No extra command or manual ID list is needed. Measurements are cached under ignored `.astro/monochrome/`, with schema, approved thumbnail hash, byte size and modification time; changing an asset remeasures it. Clearing the cache is safe. A fresh checkout uses the existing verified asset restore step before the build. Original files and their source style labels are preserved.

The site remains static: reviewed catalog and topic changes become public with the normal release. Uploading a binary to storage alone is not publication.

## Browsing

The page renders the newest 24 records initially, then uses the existing chunked search repository to reach the entire library. It never downloads the complete artwork catalog. Categories come from current topic/collection memberships; the subject selector narrows to the chosen category. Type, text search and ordering intersect the mandatory monochrome facet, so filtering never falls back into colored artwork.

Filters and page numbers are shareable in the URL, including back/forward restoration. Out-of-range pages are clamped. Search cancellation, timeouts, retry and empty-result controls preserve selected filters. File buttons use the same Image/PDF SVGs and full-screen download lightbox as other catalog cards, without download-page navigation.

The search manifest contains a small directory with current counts and available categories/subjects/types. The client rechecks it on focus, visibility return and every 30 seconds while visible. A changed release updates the directory and results together; unchanged polling does not replace cards or interrupt a download. Global count refresh uses the existing `CatalogCount` mechanism. No-script users see the initial records and a link to the existing subject directory.

## Catalog audit — 2026-10-25

- All 8,200 published thumbnails were inspected by the pixel audit. Contact sheets of additional neutral candidates and conflicting metadata were reviewed visually.
- 1,488 records qualify, across 163 subjects and 14 categories. Category totals can overlap because a subject can belong to more than one collection.
- 25 neutral originals were missing from the old style-only selection and now qualify automatically.
- 10 previously selected Outline/Black & White records contain color and are excluded from this library. They remain available in the regular catalog.
- The old page exposed only the first 32 results. Pagination now reaches the whole eligible catalog.
- `black-and-white-audit-2026-10-25.json` records the added/excluded IDs as audit evidence only. Runtime membership does not read that snapshot.

The local page and search manifest compiled successfully. Astro diagnostics reported zero errors and zero warnings, with one pre-existing unused-parameter hint. No browser interaction pass is claimed.
