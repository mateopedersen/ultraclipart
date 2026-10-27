# Check existing content before every new production topic — 2026-10-26

Latest explicit owner direction: do not draw a topic that already has content.
Before starting each keyword, double-check the actual live topic/search results
and the accepted local catalog, owner-supplied imports, staged sources and queued
plans. Resolve topic aliases and inspect related results so a different spelling
does not trigger duplicate production. When existing content fulfills the topic,
skip new drawings and move to a genuinely missing topic. Apple is explicitly
skipped: its existing live collection was verified; no new Apple drawing was made.
Continue quality checks and publication of already-created approved artwork.
Record skipped topics separately; owner-supplied designs and skipped slots must
never be relabeled as newly generated originals toward the 5,500 count.

# Local update workflow

The project owner set this workflow on 2026-10-25:

- Make updates locally and proceed one requested step at a time.
- Preserve the pending local changes when starting the next step.
- Show the local preview for review.
- Do not push to GitHub, create publication PRs, merge branches, deploy to Cloudflare, or change production until the human explicitly says to publish the current batch (for example, “canlıya al” or “deploya al”).
- Earlier publication authorization applies only to its completed release, not to subsequent updates.

The owner explicitly authorized publication of this accumulated batch on
2026-10-26 and requested that publication proceed without another confirmation.
That approval does not apply to later, unrelated changes.

## Approved site design — 2026-10-25

- The owner approved the current For Teachers design and requested the same design for Guides.
- LATEST FONT DECISION: The owner reversed the site-wide font change. Keep Source Sans 3 (`UltraClipart Reader`) ONLY on For Teachers and Guides (including their tutorial pages). All other pages use the original Avenir / self-hosted Inter font system. Layout scopes the Reader family and preload using `reader-page`. Do not reapply Reader across the site without a new request. Fonts chosen for an editable artwork remain part of that artwork.
- On Teachers and Guides, keep reading text comfortable (about 19–20 px), headings clearly weighted at 700, and meaningful labels legible. Match equivalent titles and actions across cards.
- Preserve the blue, navy and white brand palette; do not introduce a green page theme.
- Reuse TeacherSymbol and TeacherArrow for the approved shaded SVG object and arrow family. Use consistent blue filled actions with clear labels and enough space for wrapped text.
- Guides explain actual controls with real site screenshots, numbered pointers and practical instructions. Do not present invented sample interfaces as real captures.
- Image frames in repeated cards must have a definite shared aspect ratio independent of source image dimensions. Fit images inside the frame, reserve heading space, and align the last row of controls or metadata.
- Keep every update in this batch local until the owner explicitly authorizes publishing it.
- Homepage and shared footer copy should describe the actual content or action in plain language. The owner rejected slogan fragments, decorative eyebrow labels and oversized two-line navigation buttons. Keep the footer's Browse Clipart / Open Clipart Studio actions compact with small leading illustrations and no trailing arrows. Homepage collection links use readable underlined text without an external-link arrow. Preserve the blue palette, lighter heading weight and aligned card copy.
- Shared footer order: invitation, navigation cards, then the logo and site description in the bottom area above the copyright row. The description explains the clipart and design tools; keep it visible on mobile as well.
- The Browse dropdown preview uses `BrowsePreview.astro`: twelve real published catalog thumbnails across different subjects in a compact three-column display with visible card thickness, perspective and shaded edges. Keep its heading and action close to the artwork; do not stretch the copy away with space-between or margin-top: auto. Resolve thumbnails through the catalog's approved asset map, use the live subject count and preserve the existing compact mobile navigation.
- Catalog totals must update automatically as published artwork and registered subjects change. Use `CatalogCount.astro` and `catalogStatistics` for public artwork, subject, collection and print-library totals; never enter a fixed catalog size. Counts come from `publishedArt` and exclude drafts/withdrawn/non-indexable records. `/catalog-stats.json` is generated in every normal build with no-store caching; visible pages refresh counts on load, focus/return and every 30 seconds. Keep complete build-time values as the no-script/offline fallback. Search, Favorites and directory result counts describe their actual current result lists and stay owned by those clients. Collection-copy quantity claims use `CollectionCountCopy` / `resolveCollectionCountCopy`; prefer `{{artworkCount}}` in future text. Publishing assets alone does not add catalog content: the reviewed catalog/topic update must be part of the normal site release.

- File action buttons share CardFileActions, the colored SVG assets under `public/illustrations/actions/`, and the same dynamic-card asset map. Keep Image / PDF labels and icons identical in catalog cards and More like this.
- Catalog card titles, homepage subject labels, and More like this titles use font weight 600. The owner requested a lighter appearance; preserve the current font families and sizes.
- More like this captions describe each candidate's own scene, object or visual details in a short paragraph, at most 125 characters. Always use `artworkCardSummary`. Matching edited entries in `data/artwork-card-summaries.json` are preserved; new or revised artwork automatically uses `automaticArtworkSummary` from `src/lib/artwork-summary.ts`, reading its own description, alt and title. New imports need no separate caption entry or command. Editorial overrides are optional and must carry the matching `artworkSummarySource` signature. Keep source metadata accurate and descriptive. Keep captions specific and distinct, with natural wrapping. Group headings explain the relationship; captions must not repeat generic collection labels or similarity claims. Do not clip long text, append ellipses, or invent visual details for variety. Bump `AUTO_SUMMARY_VERSION` when changing generation rules to invalidate old browser snapshots.

## Black & White library

- `/black-and-white/` uses `blackAndWhiteArt` from the shared catalog. Normal development and builds inspect approved original thumbnails through `scripts/monochrome-catalog.mjs`; no manually maintained artwork ID list, separate import command or image conversion is required. The ignored `.astro/monochrome/` cache stores measurements, bound to thumbnail hash, size and modification time. Keep classification server-side.
- Use the audited boolean for the Black & White gallery, its printable count and the shared search monochrome facet. Metadata marked Outline/Black & White is checked for colored accents too; a black subject, colored neon outline or editable color drawing does not qualify solely on its name or editability. Originals stay intact.
- Category/subject/type options and their counts come from eligible published artwork and existing topic memberships. Search remains scoped to monochrome results across all pages. Reuse shared Card and file-action/lightbox behavior. Refresh the versioned manifest on focus/return and while visible to include newly published content. New assets still enter the reviewed catalog and normal release; uploading a file alone does not publish it.

## Studio libraries and inspector — 2026-10-25

- Studio opens with up to 500 real, published featured artworks, balanced across registered subjects by `src/lib/studio-artwork.ts`. Keep the full catalog searchable. Counts use actual results; changing a filter searches the full catalog. Libraries paginate 24 previews at a time instead of mounting hundreds of cards. Preserve original artwork verification and existing source limits.
- The vector library contains 276 existing original elements plus 1,724 distinct Tabler Icons from the pinned, MIT-licensed `@tabler/icons` 3.49.0 package. Sources, hashes and package integrity are recorded in `data/studio-vector-provenance.json`. The reproducible importer is `scripts/build-studio-icon-pack.py`; it rejects a different archive checksum, excludes brand categories and disabled/numbered variants, removes invisible bounds paths, and preserves only supported SVG primitives. Never inflate counts with color/size copies. Preserve original IDs and favorite storage keys.
- Keep the Tabler MIT notice in `public/licenses/`, the License page and each imported vector's `desc`. Separate Parts preserves these notices in its new layers. Original catalog licensing and the third-party icon license remain separate.
- `Editor.astro` uses a persistent inspector header, one independently scrolling `.uc-inspector-body`, and a footer with View Canvas, Layers and Download actions. Keep existing control data attributes and project/history contracts. `studio-inspector.css` is shared across creation and artwork editors. Use the current viewport height, including mobile keyboard changes; do not restore fixed, overflowing panel heights or hide inaccessible controls.
- `mountColorFields` adds synchronized native picker / HEX inputs to background, vector, text, region and effect colors. Accept 3/6 digit HEX with or without `#`, normalize to six digits, and preserve the last committed color for invalid entries or Escape. Color events flow through the existing editor actions and undo handling. Region controls explain the empty state and disable unavailable operations until an unlocked visible image layer is selected.
- The create-page starter gallery has 18 real compositions in seven categories, with 12 varied new subjects before the six preserved legacy IDs. Each design has its own description; do not restore per-card quantity lines such as “2 images + text”. Category labels use 700 and card titles 600. Search/filter/Show More reuse the same source-safe scene loader and undo; show full initial rows (9/6/3 at three/two/one columns). Keep every source inside the 1400 × 1000 canvas, with build-time bounds guards.
- `StudioWalkthrough.astro` explains three practical steps with real catalog laptop/robot/guitar examples and separately labeled crops of genuine site captures. Do not fabricate an editor screenshot. Tutorial footer actions stay bottom-aligned; secondary links use 600 and the same text inset as their primary buttons, including the button border.
- Local diagnostics and catalog/asset audits are evidence of compilation/content only. The browser tool still reports Local browser use disabled; do not claim desktop/mobile interaction or export tests passed without real browser access. This batch remains local.

## About team

The owner identified the blue-shirted reference as Melih and the green-shirted reference as Mustafa, both co-founders. LATEST APPROVED PORTRAITS: use separate vertical team cards with face-only, passport-framed cartoon avatars, not selfies or full-body characters. Melih uses `public/team/melih-cartoon-v3.webp`; Mustafa uses the approved slimmer-face `public/team/mustafa-cartoon-v4.webp`. Full-resolution sources and prompts are in `design-assets/team/`. The owner approved short, project-focused bios, then explicitly assigned Melih the design / visual direction story and Mustafa the software / infrastructure story. Use those roles with natural, warm copy about their interest in the project. Do not invent education, past employers, awards, or founding dates. Keep this addition local with the rest of the batch.

About polish: keep founder role headings as “Design & Creative Direction” and “Software & Infrastructure”, with matching “Co-Founder” badges. Section labels should remain clearly readable. The About contact area uses the illustrated envelope action and an aligned Copyright and corrections link; the owner removed its standalone email-address line.

About social cover — latest owner direction: do not use founder portraits, names or roles in the About OG/Twitter image. Its cover represents UltraClipart itself: the blue U emblem, layered original-art cards, a palette and pencil. Keep the approved portraits in the About page's team section. The owner approved all other social covers; preserve their image bytes and compositions when changing About.

## Download lightbox — 2026-10-25

- Catalog Image/PDF controls open the shared DownloadPanel as a full-screen lightbox over the current page. Preserve the dark blue overlay, large white file screen, native dialog focus management, close controls and background scroll position. Do not create a download HTML page, change the URL/query/hash, push history, or open a new tab for this flow.
- Use the data-download-open artwork ID and data-download-format contract on static and dynamic cards, with direct original-file URLs and download filenames as the no-script fallback.
- Preserve verified file size, MIME/signature, origin and SHA-256 checks. Closing, switching format or replacing the source cards cancels pending work.
- The old download route is removed. Keep the legacy permanent redirect to the matching artwork page in public/_redirects. Keep Guides and teacher instructions aligned with the lightbox flow.
- Cache cleanup may remove generated output and tool caches, but must preserve Favorites, boards and editable projects. The current batch remains local until explicitly approved for publication.

## AI Builder maintenance

- Preserve same-origin, signed-session, Turnstile, provider allowlist and free-capacity protections. Never recover by bypassing verification, enabling a paid provider, resetting the production ledger or substituting a catalog/example image for inference.
- Client quota responses, retry deadlines, service error parsing and prompt transfer use the helpers under `src/ai/`. Keep generation failures visible when refreshing quota afterward. The server exposes real network/visitor/circuit cooldowns; no automatic inference retries.
- Development-only `scripts/ai-preview.mjs` reports missing Cloudflare bindings honestly and offers an explicit live Builder handoff. It must not be treated as a real local inference service or included as a production replacement. AI requests use the site's trailing-slash convention.
- The owner requested thorough AI testing on 2026-10-25. Keep API, client-state, storage, cutout, PDF and Studio transfer coverage. Recorded fixtures are UI contracts, never proof of fresh model generation. Do not claim browser tests passed when tool access is unavailable. Current fixes stay local until publication is explicitly requested.

## Expanded Text and Studio Pro — 2026-10-25

- `src/editor/text-styles.ts` is the single source for 60 editable treatments in ten categories. These are text styles using the three supported type families, not 60 separate fonts. Previews use the same `textNodes` renderer as the canvas and paginate 12 at a time. Preserve user-entered words when changing a style; new text is measured and fitted inside the current canvas/crop. Keep existing text project and PDF font contracts.
- The combined vector library now has 2,000 unique elements (276 originals and 1,724 pinned MIT Tabler assets). Keep every previous ID and favorite key. The importer checks archive integrity, sanitizes primitives and records source hashes; do not pad counts with color/size duplicates.
- Studio Pro has a searchable, category-filtered directory with 16 real tools. `pro-tools.ts` adds circular/spiral copies, selected-item grid layout, eight editable vector backgrounds/frames, proportional format fitting/trim, and a document boundary/source-enlargement report. Changes go through the existing commit/undo and source/markup/size limits. Select complete unlocked groups for arrangements. Background reapply replaces its own layer; Canvas Fit explains background regeneration. A canvas review is a geometry/source-size aid, not proof of print quality or successful exports.
- Continue to keep this batch local. Static diagnostics and content counts do not establish browser interaction results.

## Search — 2026-10-25

- Public search covers all published/indexable artwork plus subjects, collections, public pages, guides/teacher flows, Studio controls, starters, vectors and text styles. Sources are `search-build.ts` and `site-search-build.ts`; never restrict discovery to the featured Studio subset or index private projects, Favorites content, AI history or prompts.
- Language normalization and title-position ranking live in `search-language.ts`. Bump `SEARCH_LANGUAGE_VERSION` after rule changes. Match scene/title/alt and actual public facets. Keep complete and partial matches separate and label missing terms; do not silently discard requested details or invent image labels. Synonyms are for retrieval, not product-identity metadata.
- Preserve sharded card/facet loading, cancellation guards, scoped Black & White results, verified downloads, Favorites keys and query/filter history. New Studio search links open/reveal tools or starters without replacing a saved project. See `docs/search.md`.

## Branded-subject identification — owner preference

For all vehicle, device and other branded-product imports, follow `docs/content/product-identification.md`. Inspect the original image, compare current official manufacturer sources, and bind the identification review to the source SHA-256. Use only the supported model/generation or recognizable family; do not derive exact models, trims, years or specifications from filenames, color or brand. Explicitly label speculative designs as concepts. Keep the reviewed identity consistent in heading, alt, description and image schema. A replacement checksum invalidates the previous identification review.

## AI Builder example variety — 2026-10-25

- The owner requested many understandable examples beyond repetitive animal/woodland subjects. `src/ai/ideas.ts` supplies 48 public ideas across 12 categories, spanning the original 15 style choices. Keep examples diverse and specific. Resolve subject references through published catalog artwork; label them as references, never generated results or guaranteed outputs.
- Example selection edits the draft and style only. Preserve generation/quota/security and local history behavior. Built-in/custom details share an eight-item limit and removable selected chips. Keep category/search/pagination controls usable on smaller screens; do not mount every example visibly at once.
- Keep the existing homepage artwork and its matching prompt transfer together via `invitationExamples`. Only public curated descriptions may enter search; never visitor prompts or history. See `docs/ai-builder-examples.md`. This batch remains local.

## Interface copy and select controls — latest owner direction

- The owner requested a site-wide cleanup of formulaic copy and overly decorative presentation. Use specific subject/task headings and ordinary explanatory sentences. Avoid generic slogan fragments, repeated creative metaphors, unrelated sparkle/dot ornaments and stacked 3D display effects. The homepage display and invitation components now use contained grids. Keep the approved blue palette, original font scope, real artwork and readable controls.
- Do not imply human authorship or handmade provenance without evidence. Keep real tool names and accurate service/privacy terms. LATEST OWNER DIRECTION: omit production-origin labels such as “AI-generated artwork” and “created with AI” from public interface copy, image alt text and social covers. Preserve internal source records, source checksums, license terms and reviewed artwork identities.
- `src/styles/select-controls.css` is the common contract for all native single-choice dropdowns. Keep the same-origin SVG chevron and reserved inline-end text space intact across component padding/background rules. Use the supplied custom properties for a needed surface or geometry variation. Keep multiple/listbox controls native and restore the OS arrow for forced colors. New dropdowns inherit the contract without a JavaScript wrapper.
- See `docs/interface-polish-2026-10-25.md` for scope and evidence. Compiler/server-output inventories do not establish browser layout or interaction results. Keep this batch local until the owner explicitly authorizes publishing it.

## Illustrated 404 — latest redesign, 2026-10-26

- LATEST owner request rejected the flat folder illustration and then requested a completely different whole-page structure. The current 404 uses a centered 3D sculpture, short error explanation, a distinct recovery/search panel, useful-destination links, a four-subject illustrated gallery and contact strip. On mobile the explanation precedes the illustration and recovery panel. Preserve this complete composition rather than restoring the rejected split folder layout.
- The actual modeled 3D scene is rendered offline from `design-assets/not-found-3d/scene.mjs`. Beveled blue/white numerals, a metallic/glass magnifying lens and two source-verified artwork cards render to a transparent PNG; `publish.mjs` creates responsive content-hashed WebP files and `data/not-found-visual.json`. Three.js is pinned to 0.180.0 with verified registry integrity; licenses and source/render checksums are retained. Neither Three.js nor WebGL is sent to visitors. The built-in image-generation attempt failed with a usage limit; no CLI/API-key fallback was used.
- Shared live suggestions enhance the native GET search without a separate 404 script. Use root-relative navigation and verified asset URLs so missing nested addresses work. Preserve noindex, actual HTTP 404, readable equal-height links and the no-JavaScript search fallback; never redirect automatically. The scene has its own descriptive alt/title, and catalog subject illustrations retain their own metadata. This update remains local.
- `tests/e2e/not-found.mjs` belongs to the interface-pages CI suite. Check Chromium/WebKit widths 320–1920, real missing/deep routes and HEAD responses, accessibility, search and recovery links. Browser-engine emulation is not a physical iPhone/Android test.
- The shared footer invitation previously showed yellow speckle corruption in WebKit. Its stacked radial/linear backdrop was isolated as the cause; preserve the continuous blue/white linear backdrop in `site-display-restoration.css`. The 404 browser test checks the rendered footer copy at 390/1440 with artwork/icons masked so legitimate yellow artwork is not mistaken for corruption. Recheck the shared footer suite after changes to this backdrop.

## Contact page and Google Forms — 2026-10-26

- Contact has its own `src/pages/contact.astro` route, blue envelope/letter illustration, seven illustrated guidance choices, Google Forms gateway, direct email alternative, process explanation and practical FAQs. Keep the original site font scope and responsive card alignment. The website changes remain local until separately authorized for publication.
- The owner explicitly requested Google Forms integration. The form was created in `ultraclipart@gmail.com`: editor ID `1aKQ6eUo82a1UWAK3V-8rp5HrY1AwF4xJS6qFO-WBDRs`, public form and topic pre-fill key in `src/lib/contact.ts`. It accepts public responses without requiring Google sign-in. Only the response form is public; response summaries remain private. New-response email notifications are enabled for the owner. Keep form options and the shared topic map synchronized.
- Load the actual Google iframe only after the visitor clicks Open contact form. Preserve its direct link and email/no-script alternatives, the Google privacy disclosure, required reply-email validation and optional name/page URL. Topic-tip changes must never reload an open iframe or discard a draft. A frame load event is not proof that Google accepted a message. Never replace the supported Google form with an unverified cross-origin POST or report success from an opaque response.
- `scripts/contact-security.mjs` adds only `frame-src https://docs.google.com` for `/contact/` in normal release headers. Preserve all existing script, connection, form-action and framing restrictions on other routes. Keep the privacy provider/data-map disclosure consistent with this integration.
- Run `tests/contact.mjs` and `tests/e2e/contact.mjs`. The CI browser test uses an explicitly labeled iframe fixture; `CONTACT_GOOGLE_LIVE=1` runs real anonymous Google embedding/prefill/validation checks without submitting a response. Actual one-off owner QA submissions were also checked in the Forms Responses panel (two clearly labeled test records remain, including the first test that exposed the original email-rule error). A notification setting is not proof that a notification arrived in the inbox.

## Page-specific OG images — 2026-10-25

- The owner requested visually rich, page-specific social covers with natural editorial layouts. Use the route compositions in `scripts/social/`, the generated `data/social-images.json` mapping and the shared Layout resolver. Preserve actual artwork, approved team portraits, blue/navy branding, readable text and subject relevance. Avoid unrelated generic graphics, fabricated product captures, fixed catalog totals or unsupported human-authorship claims. Production-origin captions are omitted under the latest owner direction; functional tool names remain accurate.
- Normal builds restore verified artwork, regenerate hashed 1200 × 630 PNGs and then compile metadata. `social:build` regenerates covers locally. Preserve source/font/output checksums and text-bound checks in `data/social-image-provenance.json`; original artwork is never modified. See `docs/social-images.md` and `design-assets/social/overview.png`.
- Dedicated hub covers take precedence. Artwork, subject, collection-detail and artwork-editor pages use their own relevant original with its real MIME/dimensions. Keep one OG/Twitter image set and absolute production HTTPS URLs. The 404 template explicitly selects its own cover. Preserve existing noindex/canonical/schema rules. Keep this batch local until the owner explicitly authorizes publishing it.

## Dimensional visual restoration — LATEST owner direction

- The owner explicitly rejected flattening the homepage AND other areas and approved the earlier illuminated, shaded, dimensional displays and badges. This supersedes the earlier instruction to remove those decorative visuals. Preserve the improved current text, readable catalog titles, working controls, automatic counts and all OG work.
- The archived homepage display styles and AI invitation appearance are restored from commit `84e9616`; their current copy and current prompt-transfer behavior are retained. The project invitation has its raised papers, color strip, pencils and layer badge again, with the approved illustrated Start Your Design action. Shared footer invitations on ALL pages regain layered displays, lights, palette and heart through `site-display-restoration.css`; the current compact actions, navigation arrows, footer order, revised text and removal of Your Saved Artwork remain intact. Studio surfaces, shadows, dimensional image treatment and card styles are restored while preserving the separately requested new brand label, inspector and expanded libraries. The header's original New badge styling is restored.
- Do not flatten, remove ornamental stages or replace this approved visual direction again without a new explicit request. Keep this batch local.

## Cookie information — 2026-10-25

- The owner requested a site-themed cookie strip on all pages for visitors outside the United States, plus a current Cookie Policy. Layout includes `CookieNotice.astro`; `/cookies/` lists the actual application cookies and feature storage. The shared footer exposes Cookie Policy and Cookie Settings to every visitor. Keep the shaded blue/white design and illustrated cookie/shield.
- Production `/api/cookie-region.json` uses only edge-provided `request.cf.country`. Only confirmed `US` skips the initial strip; unknown country, API failures and local previews show it. Do not infer region from language/timezone or add a third-party geolocation call. The response is private/no-store and returns a boolean, without storing country or returning an IP. The existing `/api/*` worker routing covers it.
- The current site has necessary security/choice cookies and requested local feature storage, with no advertising or analytics cookies. Accept Cookies and Necessary Only are equally prominent and keep tracking disabled; do not create fake optional switches or interpret acceptance as permission for future tracking. A real new optional purpose requires a new, specific consent mechanism before activation, not reuse of this acknowledgement.
- The versioned `uc_cookie_choice` record remembers either explicit choice for 180 days, with Secure on HTTPS, SameSite=Lax and Path=/. It has no visitor ID. Cookie-blocked browsers keep the choice only in page memory. No scroll/navigation/implied acceptance. Cookie Settings remains reachable; native dialog handles focus/Escape. Choosing either option must never clear projects, Favorites, boards, history or removal keys.
- Keep security/session, generation and sharing protections intact. The policy reflects the application’s actual 24-hour security cookies, local feature storage, seven-day Builder history and one-hour transfer. Sources and limitations are in `docs/cookies.md`. Keep the current batch local; static diagnostics/server markup are not proof of browser interactions or real US/non-US edge delivery.

## Studio welcome and project header — latest owner direction

- The owner rejected the repeated Studio logo/name and the extra Your Workspace header. Keep one “Welcome to Studio.” heading, with no separate logo above it. The creator editor starts with a compact project title, Saving & privacy link and the existing command buttons in one wrapping header. Do not restore the duplicate label/identity bars or imply a saved state.
- Keep the two welcome actions equal in width and height, including their lower shaded edges. The three real library counts use equal cells and bold labels. Explanatory landing-page copy uses stronger navy contrast and 500–600 weights; headings and meaningful action labels use 700. Do not change editable canvas text or the original font-family scope.
- The owner explicitly rejected both overlapping hero artwork and enclosing every picture in a card. Laptop, imaginary robot and guitar now occupy separate unframed grid areas, with contained full images, aligned lower edges and soft grounding shadows. Keep the surrounding composition open and prevent image overlap; do not restore the individual white boxes, card borders or absolute free-floating object placements.
- Intro, navigation, starters, tutorial and help sections share aligned outer edges and a consistent spacing rhythm. On small screens actions wrap without clipping and the original editing controls remain reachable. This batch remains local.

## Homepage variety and display — latest local refinement

- The owner requested a general clipart homepage with varied subjects instead of a woodland/animal focus. `HomeShowcase.astro` presents flowers, food, school, music, sports, botanicals and winter artwork in a layered blue/white display. These seven named illustrations link directly to their artwork pages; category navigation belongs to the six shortcuts. Seasonal cards use their own named collection links instead of repeating Browse Collection. Keep actual published artwork, dimensional paper edges and shadows, readable labels, and a strong raised Browse All Subjects action. Its subject badge and illustration total use `CatalogCount`; never type fixed totals.
- The owner explicitly removed the small icon and UltraClipart Library label above the hero after rejecting both the SVG and illustrated-book versions. Begin with the main heading; do not restore that label or replace it with another ornament.
- LATEST HOMEPAGE STRUCTURE: the homepage no longer mounts the duplicate HomeSubjectGallery, the AI Builder invitation or the generic footer invitation. The owner retained AI access in the upper navigation and explicitly removed its homepage promotion. Keep the original invitation components available for other contexts, and retain the dimensional footer invitation on other pages. The homepage order is showcase/category shortcuts, Recently Added, Seasonal Collections, project editing and usage help.
- The search-area shortcuts use `HomeCategoryLinks.astro`: six broad categories (Animals, Food & Drink, School, Technology, Family and Nature), compact illustrated cards and a different short description for each category. The owner rejected repeated quantity lines such as 50 illustrations; do not restore those lines on the homepage shortcuts. The single All Subjects action and live subject total remain in the large showcase; do not repeat them beside Browse Categories. Keep the default selection limited to six instead of growing a long homepage directory; all remaining subjects are available through the directory. The wide layout uses three columns/two rows, medium and mobile layouts reserve enough room for labels and counts. Do not reuse the seven display subjects as the entire shortcut navigation.

- The owner removed the free personal/educational use note and adjacent License link from the homepage hero. Do not restore that line beneath the category shortcuts.

- Recently Added renders up to 15 real, distinct-subject picks. Container-based columns and visible-card limits keep complete rows: 15/12/9 across five/four/three columns and six across two/one columns. Keep the existing actual chronological selection, shared Card controls and /new/ link; do not add dummy cards or duplicate artwork to fill the row.

- Homepage Using UltraClipart alignment: center the section heading and introduction. `HomeBenefits.astro` uses one responsive `--benefit-gap` for the frame padding and equal card gaps, including the existing 5 px lower card edge in bottom padding. Keep equal image heights, shared two-line heading space on multi-column layouts, consistent copy padding and bottom-aligned links. Hover may change the border/shadow color but must not move a card or its artwork out of the row. Single-column mobile cards do not reserve an unused heading line. Preserve the existing illustrations and text.

## AI Builder choice dialogs and viewport — latest local refinement

- The owner rejected the small native dropdown menu and requested a polished mobile-friendly selection system. `choice-picker.ts`, `AiChoicePicker.astro` and `ai-choice-picker.css` progressively enhance the nine existing selects on the Builder with one shared native dialog. Categories/styles use published catalog reference thumbnails and search; other choices use clear option buttons. Preserve each original select ID, value, name and change/input events. Keep the native control available as a fallback when dialog support is unavailable. Other site selects retain the global native arrow contract.
- Keep close/Escape/backdrop behavior, keyboard focus return, selectable-state indicators, minimum 44 px controls, 16 px search inputs, safe-area padding and visual-viewport sizing. On mobile the dialog is a bottom sheet with one scrolling option area; desktop uses a bounded centered panel. Programmatic style/example/history changes refresh labels, and generation busy state disables selection. Opening a choice must never request inference.
- LATEST BUILDER LAYOUT: the owner rejected the enlarged cards and fixed-height panels, requested the preceding compact appearance, then approved that restored layout as the basis for further polish. Keep the compact two-column desktop layout, four ingredient/style references per desktop row, original numbered workflow and Create Clipart / From a Description heading. Panels use natural page height with no independent workspace scrolling or fixed generation footer. Mobile uses one column with two ingredient/style cards per row. Images use contain, captions wrap and controls follow the form; never cut cards to fit the viewport. The PDF paper option values match the exporter (`letter` / `a4`).
- Subsequent owner feedback requests richer layered backgrounds, more realistic dimensional SVG objects, stronger buttons and tighter alignment. Describe Your Image and the subject/style groups use a compact hierarchy with bold navy labels; avoid stacking multiple decorative frames around the same controls. The description-assist action is a named button below the writing field. Builder-specific SVG objects are in `public/illustrations/builder/`; preserve their modeled faces, material gradients and grounding shadows. They are dimensional vector illustrations, not runtime 3D models.
- LATEST REFERENCE LAYOUT: the owner rejected the full-width color/generation tray as confusing and supplied the earlier two-column screenshot. Keep description, details, styles, mood/colors and generation together in the left form; the preview is on the right. Mobile has one natural page flow with no fixed footer or independent workspace scrolling. Show six quick colors, with the remaining 26 and custom HEX in More Colors. Preserve all 32 unique colors, selected chips and existing form associations. The empty preview has one tall example, a wide example and two smaller examples on desktop; all contain their full images. Mobile uses two equal columns and list view keeps its own row layout.
- Color choices use the 32 actual presets in `src/ai/colors.ts`, plus synchronized color-picker/HEX entry. `color-controls.ts` owns selection, removal, clear, the five-accent limit and busy state. Accept three/six HEX digits with or without #; invalid input never becomes a selected color. Colors enter the composed prompt and character count, never directly recolor a result or invoke generation. Choosing explicit colors clears a conflicting monochrome palette; choosing monochrome clears accents. Preserve the honest note that generation may vary the requested shades.
- Keep AI Builder action groups aligned: Refine/Variation and Image/PDF use two equal columns; Share occupies its own full-width row. View controls, prompt tools and local-edit actions use explicit grids and wrapped labels. Do not restore flex wrapping that leaves Share alone at the right edge. Keep changes scoped to the Builder and preserve disabled/generation protections.
- The style catalog has 20 actual prompt treatments: the original 15 plus Gouache, Colored Pencil, Woodcut, Clay 3D and Comic. Keep the four compact featured references and the full searchable style dialog. The new five have reviewed published catalog references and corresponding entries in both `presets.ts` and `prompt.ts`. All Styles opens the dialog without expanding unrelated settings; the native fallback reveals its containing details first. Choosing a style never requests generation.
- This batch is local. Compiler/server-output checks do not establish iPhone/device interactions; local browser tooling remains unavailable.

## Artwork navigation arrows — latest local refinement

- The owner replaced the beveled arrow on 2026-10-26. Artwork collection links and related-artwork navigation now use the clean rounded blue SVG `arrow-right-collection.svg` through `NavigationArrow variant="collection"`. The detail link uses a compact 40px pale-blue circle with a thin border; avoid extruded faces, heavy shadows or decorative highlights on this control. Preserve visible keyboard focus, actual link destinations and file/edit actions. Other shared arrows retain their existing assets.

## Pages growth warning

The owner requests a warning when a production Cloudflare Pages deployment reaches
85,000 files, ahead of the 100,000-file ceiling. Count actual deployment files
after production exclusions and verified R2 offload, rather than artwork records,
URLs or R2 media objects. Check on every release. At or above 85,000, report the
verified count and revision and recommend completing the R2/Workers catalog
transition before further growth. Do not buy a plan or change architecture
automatically. The daily thread monitor "UltraClipart 85.000 dosya eşiği"
also tracks this threshold.

## Distinct compositions for every keyword

Every published clipart must have a meaningfully different composition and use.
A redraw, repair, crop, reframing, recolor, export format or near-identical pose
does not count as another original design. Keep repairs under the same artwork ID
and creative brief; publish one reviewed version. Compare new work with published,
staged and queued artwork before release. Check exact download hashes and perceptual
similarity both within the incoming collection and against the entire catalog, then
visually inspect candidates. A changed filename or low similarity score alone is
not proof of originality. Reuse existing topic URLs. Each accepted source maps to
one WebP/PDF pair and one artwork entry. This applies to Labubu and every future
keyword.

## Generic characters need different identities and clothing

Scenario changes alone are insufficient for generic character topics. Vary face
shape, expression, hair or straw construction, headwear, clothing silhouette,
materials, footwear and accessories. Do not repeat one base character with color
swaps. Use a character-design matrix and inspect actual sources side by side;
revisions keep their artwork IDs. Preserve identifying features for branded
characters while varying appropriate poses, expressions, costumes and scenarios.
Every keyword targets 50 independent, separately useful compositions. Apply the
same identity-preserving variety review to objects and botanical subjects.

The target is 50 independent cliparts, not 50 variants of a shared base. Vary the color palette together with clothing, silhouette, materials, face and composition where applicable. Each artwork must work independently and have its own visual concept. Apply this principle logically to objects, plants and future non-character keywords while keeping the subject accurate. Review all selected artwork together; repeated base silhouettes, outfits or merely alternate media/palettes require replacement before release.

## Collection navigation and image metadata — 2026-10-26

- Latest layout request: on subject pages, show the main artwork gallery before Related Clipart Collections. Keep recommendations below the complete gallery in the source DOM as well as visually on mobile and desktop; do not float them beside or above the primary results. Preserve every artwork and relevant destination.

- Subject gallery headings use `CollectionGalleryHeading`: “Choose a design for your next idea” plus a clearly visible, separate CatalogCount badge. Keep the actual illustration count, live refresh and singular/plural formatting; never replace it with a fixed decorative number. The license remains accessible beside the heading.

- More like this uses count-aware CSS rows: on desktop, distribute incomplete four-card rows into full three-card rows; five items become a three/two split. On smaller screens a final odd card occupies the remaining row, with a sensible maximum width. A subgroup with only one recommendation uses a compact full-width horizontal card on desktop/tablet and stacks on mobile. These selectors react to current DOM children, so filters, appended recommendations and newly published artwork need no hard-coded count or additional script. Preserve every card, the recommendation ranking, specialized fruit-companion layouts and storage behavior.

- Every artwork page has a permanent “Explore this collection” section below its recommendation results, linking to the source's reviewed collection. This navigation is rendered by the shared component even when there are no recommendation cards. Do not hide it on filtering, incomplete batches or a recommendation-service failure. The optional card subgroup uses “More from this collection” to avoid repeating the heading.

- That permanent section uses `CollectionPreviewLink` with up to three actual published images from its own collection, selected by `collection-preview.ts`. Exclude the current artwork when alternatives exist, preserve each preview's own alt/title/srcset, show the automatic collection count and make the complete card a real collection link. Never substitute unrelated decorative artwork or a text-only action.

- Informative image hover/focus explanations use the shared `initImageInformation` delegate in Layout. Read that image's own title and alt, including dynamically inserted images; keep empty-alt decorative icons decorative. Preserve original SSR attributes and restore the native title after the enhanced popup closes. Keep Escape, hover persistence, dialog layering and mobile link navigation intact; run `tests/e2e/image-information.mjs`.
- Published catalog title, alt and description must be nonempty and distinct across artwork records. Never satisfy this check by appending IDs or inventing details from filenames. Inspect the original artwork when correcting metadata. The reviewed entries in `data/image-metadata-reviews.json` are bound to original WebP hashes; changing the image or reviewed wording requires renewing that review.
- Normal builds run `scripts/seo/audit-image-metadata.mjs` before release packaging. This compares every eligible artwork HTML's own image alt/title, H1, meta description and ImageObject with the catalog record. Preserve this gate for future additions and daily builds. It is an automated consistency audit, not proof that every image was visually inspected in that run.
- The live Alice/Hexed example `disney-hexed-clipart-alice-apple-basket` was read on 2026-10-26: its descriptive alt existed, its native image title was absent. That newer live artwork is absent from this older local catalog. Before any eventual publication, reconcile the current production/main catalog and these pending changes; never overwrite newer published content with this checkout's older inventory. Do not import or rename branded subjects without their source-bound identity review.

- All published artwork previews use that artwork's own catalog `alt` and `title`; never derive product identity from a filename. Shared gallery/detail/search/download/Studio renderers already propagate these values. Keep decorative UI icons empty-alt; preserve user projects and Favorites.
- `data/topic-relations.json` is the authoritative reviewed relationship map. Subject pages link directly to eligible `/clipart/<slug>/` collections through `RelatedCollections.astro`; do not restore search-query chips from legacy collection-copy fields or broad-cluster/random fallback links.
- A newly indexable subject must have an explicit relationship decision. Use up to six meaningful registered subject slugs, or `[]` when no relevant destination exists. The renderer suppresses withdrawn/incomplete destinations automatically. Do not invent trend/popularity claims without evidence.
- `scripts/seo/check-catalog.mjs` runs before the normal build and from Astro configuration, rejecting missing title/alt, unsafe or duplicate artwork IDs, unknown subjects, missing relationship decisions and invalid targets. Preserve this release gate. New artwork in an existing subject uses the shared templates without page-by-page changes.
- Run the catalog-policy/collection-navigation/search-suggestions unit tests and relevant local browser regression tests. See `docs/collection-seo-policy-2026-10-26.txt`. Keep this batch local until the owner explicitly authorizes publication.
- `/library-index/`, page sitemaps and related-collection destinations share `indexableTopics` from `src/lib/sitemaps.ts`. Count published/indexable artwork only; adding a draft must not remove an eligible subject. New eligible subjects flow into the directory automatically. Keep HTML navigation crawlable without JavaScript. Assets robots points to the XML sitemap index, never to the HTML directory as a Sitemap directive. Run `tests/e2e/library-index.mjs` when changing this flow; see `docs/library-index-2026-10-26.txt`.

## Performance batch — latest owner direction, 2026-10-26

Editorial Process has a dedicated route (`src/pages/editorial-process.astro`) and
illustrated renderer (`EditorialProcess.astro` / `EditorialIllustration.astro`).
Keep its English copy in `data/trust-pages.json` so public search and the page use
the same reviewed descriptions. Preserve existing section IDs, the original font
scope, published artwork metadata and local-only status. Keep decorative artwork
clear of the example title, readable numbered navigation and equal-height related
links. Run `tests/e2e/editorial-process.mjs` and the shared trust-page checks after
layout changes; source-CSS-injection experiments are not final compiled evidence.

- Keep this performance work AND all preceding pending local changes local. The latest owner explicitly said to save the accumulated work and not publish until asked. Earlier release approval does not authorize this batch.
- `scripts/preview-assets.mjs` produces hash-bound display copies from verified catalog sources during ordinary Astro development/builds. Preserve original download URLs, hashes, resolution and identities. Shared renderers propagate srcset/sizes; do not revert to full-size images in small cards.
- `src/lib/screen-preview.ts` preserves existing real screenshot crops and their overlay coordinates, serving lazy WebP copies; retain original full-screenshot links.
- Keep complete Studio search and vector functionality when deferring data. Preserve all user storage and verified-source checks.
- Re-run focused performance unit/browser tests when these contracts change. Keep real measurements and distinguish per-page static checks from browser/Lighthouse coverage. Never claim all pages scored 100 without those actual measurements.
- See `docs/performance-local-2026-10-26.txt`. Local Lighthouse is not a live PageSpeed/CrUX verification or proof of Cloudflare Functions behavior.

- `src/editor/verified-fetch.ts` permits browser HTTP caching while still verifying original bytes and SHA-256. A size/hash mismatch gets one cache reload; a second mismatch blocks editing/export. Preserve origin, credentials, redirect and timeout restrictions. The edit-page head bootstrap and main editor consume the same page-owned promise once.
- Keep footer image `sizes` aligned with the CSS frame and transform at each breakpoint; do not give a 120px mobile illustration a generic 160px or viewport-sized hint. Preserve high-density candidates.

- Mobile search renders artwork before the separate directory finishes. `LatestRequest` guards both incremental and final updates; preserve existing card nodes when only directory results arrive. A directory failure must not erase valid artwork, and its explicit retry must work. Query-bearing visits must not download irrelevant seed-gallery images.
- Artwork editors may paint a generated screen copy while the full original verifies. Keep controls inert until the original passes all size/hash/dimension checks. `rasterPreview` defaults to the original for export/processing; only the screen canvas supplies a finite device-pixel scale. Zoom beyond the derivative's resolution uses the original. A missing display derivative falls back to the verified original. Verification failure clears the preview and blocks edits/exports.
- `bootstrap.ts` defers an offscreen Studio, preserves first launcher/starter actions, and initializes direct tool links. Keep visible loading/failure/retry states. Do not insert arbitrary delays to manipulate metrics. `screen-canvas.ts` reuses painted SVG nodes; verify transforms, layer text, undo, project restoration and actual exports after changing it. Run `tests/e2e/mobile-performance.mjs` with the existing performance/search/raster suites.

- The small `cookie-startup.ts` head bundle shares `cookieRegion()` with the notice UI. A valid saved choice skips the request. Preserve the bounded same-origin request, conservative failure policy and exact release CSP hashes. Image editors retain image-preload priority and use the normal notice module rather than the extra early head bundle.
- `StudioIcon.astro` paint-server IDs use a per-document `Astro.locals` counter. Keep IDs unique within the document and preserve the existing vector appearance.
- `tests/e2e/all-route-layout.mjs` navigates every built HTML URL at 320/1440 with JavaScript disabled. This is structural layout evidence, not per-URL interaction or Lighthouse coverage. A resumed scan may reuse only the same unchanged build; interrupted/failed addresses must be revisited. Retain failure evidence. Separate full-JavaScript layout, accessibility, search and export tests remain necessary.

## Catalog image SEO — 2026-10-26 local batch

- `src/lib/image-schema.ts` is the shared ImageObject source. Keep each artwork's reviewed title, description, caption/alt, actual content URL, stable identity, real dimensions/encoding, Organization creator, credit, qualified copyright notice and personal/educational license URL consistent. Do not claim universal copyrightability, exclusive third-party subject rights or unverified human authorship.
- The `ultraclipart-catalog-image-seo` Astro build integration launches `scripts/seo/build-image-seo.mjs` in a separate process. It adds deduplicated metadata for actual informative catalog images rendered on indexable pages, then audits all compiled HTML, responsive source ownership, image signatures and sitemaps. Preserve this gate even when a publisher invokes Astro directly. Decorative icons, team portraits, guide screenshots and private/noindex pages must not receive a blanket clipart license.
- Keep image metadata strings retained in audit reports detached from large HTML substring buffers. Otherwise a complete-site scan can retain gigabytes of documents and exhaust the heap. The complete scan must pass within ordinary runtime limits; do not solve this by disabling the gate or merely increasing memory.
- New approved images flow through their own catalog metadata and checksum-bound screen previews automatically. This propagation does not replace original-image review, especially the branded-product identification contract. This SEO pass adds 28 original-image reviews; the accumulated local batch has 85. Never describe the automated check of all 12,152 records as a fresh visual review of every image.
- `tests/image-seo.mjs`, `tests/e2e/image-seo.mjs` and `tests/e2e/image-information.mjs` cover the shared schema, noindex/privacy exclusions, mobile/desktop Chromium and WebKit, touch search navigation, original file hashes and hover/focus behavior. Wait for the actual search results to finish before navigating away in the metadata browser audit. Never run a rebuild against the same output directory during a browser verification run.
- The Turkish report is generated by `scripts/seo/report-image-seo.mjs` under `reports/image-seo/`; the local server exposes `/__image-seo-report/` and `/__image-seo-evidence/`. These diagnostic artifacts must stay out of public/ and release sitemaps.
- This batch remains LOCAL ONLY. The read-only live audit found 12,904 image sitemap entries, 752 absent from this checkout's old publication list, and HTTP 404 at the assets-host robots.txt. Preserve all newer live content during future reconciliation; do not publish this older inventory over it. The prepared assets robots root object is a separate authorized R2 publication step. A robots.txt 404 alone is not evidence of Googlebot blocking.

## Shared page spacing and gallery rows — owner request 2026-10-26

- Close excessive blank areas by organizing existing content. Do not add filler sections, duplicate cards, hide existing results, remove cards or change their order to fill a row.
- The main container owns the footer separation through `--page-footer-gap` (28–40px). `footer.site-footer` must not add a second top margin. Normalize the final real main child’s trailing margin, excluding scripts, styles, templates, closed dialogs, hidden and screen-reader helper nodes. Keep the logical edge rule; page-specific component margins previously made the gap 72–162px.
- Homepage sections use `--page-section-gap` (32–48px). Preserve their content/order and remove duplicate outer margins from HomeBenefits, SeasonalShowcase and CreateInvitation. Keep internal card spacing and the existing dimensional artwork.
- Shared `.gallery` uses equal-width flex rows, centered incomplete rows and responsive column/gap variables. A 32-item gallery uses four columns on wide screens. Do not restore five-column 32-item rows with two stranded cards at the left. The homepage recent gallery retains its own full-row grid and responsive visible counts. Black & White and search/gallery renderer overrides must use the same column/gap variables, including dynamic filtered results.
- Run `tests/e2e/spacing.mjs` and `scripts/seo/audit-spacing-build.mjs` against a completed, unchanged build. The browser scan measures every distinct template, every subject and one detail per subject; the complete HTML audit verifies shared rules on all generated routes. Describe those scopes accurately; do not imply every catalog URL was manually inspected. Keep separate JavaScript-on navigation, footer and image-information checks.
- Keep this and all accumulated changes local until the owner explicitly authorizes publication.

## Local preview releases and footer — 2026-10-26

- New Clipart has a server-rendered newest-first fallback and a shared search-manifest refresh on load, return/focus and every 30 seconds while visible. Show more retrieves further approved records from the existing versioned search index; do not hard-limit the page to its first 32 items or clear existing results on a refresh error. The publication-order helper compares parsed UTC instants, prefers immutable firstPublishedAt/publishedAt when supplied and uses later catalog position for equal timestamps. New imports should retain an accurate first publication timestamp; uploading a file alone does not bypass catalog review or publish it. The owner declined a remote-catalog reconciliation during this local task; do not import or overwrite newer remote content implicitly.

- Run `node scripts/performance/build.mjs` (package script `performance:build`) for the local release preview. It builds into a separate release directory, runs the normal SEO/link gates and only then atomically switches `work/performance-build`. Never rebuild directly into the directory served by an open preview. The ordinary production build remains unchanged. Preserve failed-build diagnostics and the previous usable preview.
- The footer bottom row contains the logo with © year underneath, the single centered sentence “Discover clipart for your next creative project.” with its palette emoji, and Back To Top. Do not restore the removed secondary slogan or usage line. The copyright uses the wordmark's navy color and 700 weight. Keep desktop centers aligned and the mobile stack centered.
- The bottom Cookie Settings link was removed at the owner's request; Cookie Policy remains in Help and contains the working settings button. Keep consent choices, privacy access and user storage intact.

## Deferred owner-supplied Marvel completions — 2026-10-26

The owner requested publication of the ready individual drawings and deferred 134 missing designs after the built-in image tool reached its daily limit. Read `docs/content/marvel-completion-backlog.md` and `design-assets/marvel-completion/pending-prompt-set.json` before continuing Avengers, Avengers: Doomsday, Doctor Doom or the latest Hexed package. Recheck current catalog counts and hashes; do not redraw published or newly supplied scenes. The three partial Marvel subjects are not complete 50-design sets.

## Preserve concurrent content releases

Before publishing owner-supplied content, refresh the latest main branch and preserve every accepted artwork, verified media representation, topic and newer collection copy. Compare sources added by concurrent releases against the incoming sources before merging. `scripts/merge-reviewed-content.mjs` merges only the reviewed incoming scope and rejects duplicate artwork IDs or incomplete representations. Never replace a newer catalog or publication manifest with an earlier staging snapshot.

## New supplied Donald Trump package — 2026-10-26

The owner explicitly authorized live publication of the reviewed 100-artwork Donald Trump package on 2026-10-26 (“onayliyorum canliya al”). Publication may proceed without another approval. Read `docs/content/donald-trump-import.md` and `work/imports/donald-trump-100/local-state.json` before resuming it. Preserve the previous 134-drawing Marvel backlog. Do not confuse the local 13,004-artwork preview with the live catalog or treat staged media as CDN-verified. Refresh current main and current production before release; record the actual successful live revision and Pages file count.

Latest Trump copy correction: the owner removed the repeated per-artwork sentence “The scene is an imagined illustration.” Keep scene-specific descriptions without this or equivalent repeated boilerplate. The collection-level context and factual character/costume identification remain.

## Current full release authorization — 2026-10-27

The owner explicitly authorized publication of all accumulated changes and preservation of newer main-branch content. Do not submit to Search Console until the owner asks. This authorization supersedes earlier local-only restrictions for this batch. Preserve user data and all accepted artwork.
