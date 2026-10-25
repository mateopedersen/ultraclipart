# Subject-aware related artwork

All `/art/[id]` pages use `RelatedArtwork.astro`. The original gallery based on the first five catalog records is removed. Main download controls, file bytes, licenses, favorite storage and editor routes are unchanged. The shared file guide is compact, with actual artwork embedded in decorative SVG illustrations and native disclosure controls for detailed information.

## Metadata and eligibility

`src/lib/related/normalize.ts` runs once per item when the catalog is imported for an Astro build. It reads catalog topic, title, alt, style, verified file metadata, publication flags and content revision. The text fields have a common production origin; they are not independent visual evidence. This release does not call a vision model or an LLM.

The controlled vocabulary in `taxonomy.ts` separates domains, families, canonical subjects and aliases. Collection names such as Winter and Thanksgiving do not become subjects. Phrase boundaries and contextual exclusions handle kiwi bird/fruit, apple/pineapple/Apple branding, orange color/fruit, fruit rings/jewelry, animal/baseball bats, Turkey country/bird, baby animals and human babies. Unknown subjects stay unknown; contradictory metadata is withheld.

An explicit catalog topic outside that vocabulary remains unclassified until a supported binding or revision-matched review exists. Title words cannot turn a new device family into fruit or animals through a color or decoration (for example a lime watch or cat-face watch). Title inference remains available for missing topics and the explicitly recognized seasonal collections.

Profiles retain separate technique, technique family, composition, depiction, color mode, secondary roles, evidence sources, rule versions and revision. `Color` is not a technique. An optional `semanticReview` adapter accepts an explicit subject only when reviewer, evidence and matching content revision are present. It does not convert an old review into new evidence.

Eligibility requires an approved, published, indexable, revisioned record, usable thumbnail/WebP paths, file hashes/sizes, the repository's approved license and file-pair review statuses, and an unambiguous subject. The existing publication validator remains responsible for checking original file hashes and CDN availability. Related queries do not issue per-card file requests.

## Two separate purposes

- Alternatives require the exact canonical subject. Scenes require compatible subject roles. A natural fruit source excludes mixed animal/fruit scenes. Simple faced fruit remains fruit, but ranks behind natural depictions for a natural source.
- Companions require an explicit subject-pair policy plus matching depiction and strong technique/composition evidence. Current companion pairs cover fruit; they are not fabricated for other subjects. Shared color, a production batch or popularity is insufficient.
- Exact identical WebP hashes and explicit canonical artwork identities are deduplicated. There is no perceptual-hash deletion or unsupported aesthetic-series claim.

Within each group the fixed maximum score is 1,000: subject 400, technique 240 (family-only 110), composition Jaccard 160, depiction 80, known color mode 60, available assets 40, reviewed metadata 20 (automatic metadata 10). Missing attributes contribute zero. These are initial interpretable weights, not a measured probability. Depiction compatibility is a ranking tier. Deterministic ties use creation time then ID. Popularity is not used.

## Bounded queries and updates

`RelatedIndex` builds bounded subject/technique/composition/color postings (96 IDs per posting). Each query examines at most 240 candidates, reserving capacity for companions. A page snapshot contains at most 56 exact-subject alternatives, 8 companions and reviewed same-collection discoveries within a shared 64-card ceiling, never the whole catalog. Dense topics deliberately use a bounded shortlist; category browsing remains available for complete exploration.

`getRelatedArtwork(sourceId, {mode, cursor, limit})` validates identities, modes, limits and cursors. Cursors bind source, mode and version. Upserts reject older or conflicting same-revision content, are idempotent, update only affected postings, and preserve deletion tombstones. New equal-quality artwork can break ties by creation time; it does not need historic clicks.

The current site is static Astro. A publication still rebuilds the site. No claim of incremental deployment or a persistent background classifier queue is made. Profiles are computed in memory once per build. There is no unbounded recommendation cache, distributed lock, added database or paid dependency.

The browser uses the page's small immutable snapshot. A tiny `related-release.json` is revalidated at startup, on bfcache return and before filters/show-more. Version mismatch hides old results and offers refresh. A failed revalidation hides recommendations and preserves main downloads, with a retry on the next filter. The release marker uses `no-store`. A static no-JavaScript page relies on normal Cloudflare Pages HTML revalidation; an already-open no-JavaScript tab cannot receive later deletions until refreshed.

## Interface

Initial server HTML contains up to eight alternatives and four companions, with no unrelated filler. JavaScript uses up to four plus two on small screens. Show-more advances the bounded snapshot without duplicates. Only filters with actual results are rendered. Black & white filters true metadata color modes. Sparse companion results use compact horizontal cards, with their distinct group label retained. The file guide uses four concise desktop columns, two on tablets and compact horizontal cards in one column on phones. Dark 18 px card headings and 14 px descriptions stay readable; metallic, shaded SVG illustrations embed the actual artwork.

Cards have real thumbnail links, `object-fit: contain`, intrinsic dimensions, lazy loading, real WebP/PDF links and the existing favorite store. A thumbnail failure replaces its image with a detail link and removes download actions. Each filter is a button with `aria-pressed`; statuses are announced politely. Native details keep file information accessible without JavaScript.

## Measurement and tests

`ultraclipart:related` CustomEvents are integration hooks, not a tracking service. They contain artwork/source IDs, mode, version, group and action. Impressions require at least 50% intersection for one second, visible document state and per-page deduplication. Download events mean clicks only, never successful saves. No cookie, visitor identity or third-party endpoint is introduced.

- `node --test tests/related.mjs`: semantic fixtures, real catalog checks, revisions, duplicate handling, cursor bounds and a 50,000-item dense subject.
- `node scripts/audit-related.mjs`: classification queue, reference output, full-catalog snapshot sizes, query timings and a measured comparison with the former full-catalog scan. Output: `reports/related/audit.json`.
- `BASE_URL=... UC_BROWSER=chromium node tests/e2e/related.mjs`: 12 real subjects at 1440/768/390/320 px; real filters, favorites, downloaded file hashes, keyboard/Axe, no-JS, stale snapshots, slow/failing service and image failures. Also runs in the existing Firefox/WebKit CI matrix.
- Existing artwork-detail, publication, catalog, editor and download checks remain in place. No gates are weakened.

Full CI runs three interface groups, three catalog/export groups, three balanced seasonal export groups and a studio group for every browser engine. All browser commands are retained, including the keyboard, scanner, tablet and book collections on main and Chromium-only extras. The interface and catalog/export work is divided to keep the growing catalog within each runner time limit. Artifacts identify both engine and group, so a failed group can be retried separately. The affected-change planner selects all three interface groups for explicitly isolated presentation changes and all groups for shared, catalog, editor or unknown changes; manual runs always select all groups. Documentation/CI-only updates validate the scope policy and workflow. The original three `validate (engine)` summary checks require a successful planner and every selected browser group to succeed, and reject unexpected skips. See `docs/ci-validation.md` for scope and rerun rules. Styled export radios are selected through their native labels, with checked-state assertions retained.

Treat measured timings as local laboratory results, not production traffic statistics. Relevance tests are an initial labeled rule-validation set; they are not an independent visual quality study. Unclassified/review-needed items appear in the audit queue and are not silently assigned a new category.

## Rollout and rollback

Publish through the existing reviewed branch/CI and Cloudflare Pages process, preserving concurrent catalog additions. No new worker or paid service is required. Reverting the feature commit and rebuilding removes the new section and guide; it does not migrate or delete catalog assets. After publication verify the release marker, reference page, several subject pages, mobile layout and original downloads on the production hostname.

## Registered collections and progressive discovery (2026-10-25)

The registry comes from `data/topics.json` and `data/extra-topics.json`. A new registered topic gets an isolated collection identity with exact title/alt context; it is never assigned a guessed shared family or promoted from a decorative mention on a different topic. Existing ambiguous-subject rules remain in force.

All publication-eligible items also enter a bounded exact-topic posting. A separate **Explore this collection** lane ranks remaining reviewed items from that same collection by known technique, composition and depiction. Its label makes a collection relationship explicit; it does not claim that different scenes are the same subject. Unknown or conflicting semantic metadata cannot enter exact-subject/fruit-companion results. Both source and candidate still require approved publication, indexability, license, pair review, revision and verified thumbnail/WebP metadata. Withdrawals invalidate the release version and remove both postings. Cross-group deduplication includes canonical identity and original file hashes.

The browser appends batches of 8 on desktop or 4 on mobile when a new downward scroll reaches the discovery sentinel. It preserves focus, revalidates the release before each batch, stops at the bounded result set, and retains the accessible button if IntersectionObserver is unavailable. No full catalog is fetched in the browser. Collection browsing remains available at the end. Tests exhaust all current detail-page snapshots and explicitly scroll through every USB result at desktop/mobile widths.

## Artwork captions — 2026-10-25

All card descriptions pass through `artworkCardSummary` in `src/lib/related/summaries.ts`. The 8,200 existing, individually edited captions in `data/artwork-card-summaries.json` remain preferred when their source signatures match. Each is at most 125 characters and describes the candidate's scene, object, arrangement or documented technique. Generic collection labels and similarity templates have been removed from the caption path. Existing group headings and reason codes continue to explain and record the recommendation relationship. Ranking, eligibility, deduplication and progressive discovery remain unchanged.

### Automatic captions for future artwork

New artwork requires **no caption dictionary entry, per-topic template or separate generation command**. The same server-side path calls `automaticArtworkSummary` from `src/lib/artwork-summary.ts` whenever an edited caption is absent or stale. All import routes converge on this path through the catalog and related index, including the initial HTML, filtered results and later discovery batches.

The automatic formatter reads the artwork's own description, alt text and title. It prefers a complete descriptive sentence, excludes usage instructions and generic collection claims, removes a repeated title prefix in alt text, and can omit file/background boilerplate. If needed it selects a whole descriptive phrase at a punctuation or modifier boundary. A concise title is the final factual fallback. It never analyzes the image pixels, invents details, appends a shared collection label, or cuts at an arbitrary character count. If the supplied metadata cannot provide any complete caption within 125 characters, the build identifies that artwork for a concise source description instead of publishing broken copy.

Existing captions carry the fingerprint of their source revision, title, description and alt text. `artworkSummarySource` rejects stale copy after a source edit, so revised records automatically use current metadata. Optional editorial overrides can still be added to the dictionary with the matching signature; automatic captions do not need to be saved there. All source metadata should describe the actual image accurately. The formatter cannot create missing visual information.

The snapshot version includes both the caption dictionary fingerprint and `AUTO_SUMMARY_VERSION`. Bump the formatter version when changing its output rules so an open browser cannot mix old and new generated captions. The dictionary and formatter run only on the server during the normal static build; browsers receive only selected snapshot text, with no new API call, model dependency or full-catalog download. Descriptions wrap naturally and are never hidden by a line clamp or shortened with ellipses.
