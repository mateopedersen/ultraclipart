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

## Illustrated 404 — 2026-10-25

- The owner requested a completely redesigned, visually rich 404 in the site's theme colors. `404.astro` and `not-found.css` use a large blue 404/magnifier composition with real catalog fox, butterfly, fern and book illustrations, a search form, Homepage/Categories actions and four illustrated subject links. Use approved published asset URLs and root-relative navigation so the page works under missing nested addresses.
- Preserve noindex and native search fallback. Shared live search suggestions enhance the form without a separate 404 script. Keep image frames contained, the copy readable, and the mobile composition responsive. Do not replace the error page with automatic redirection. This update remains local.

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

- Artwork collection links and related-artwork navigation use the dimensional blue arrow asset through `NavigationArrow` with `dimensional`. Keep its beveled face, extruded side and grounding shadow. Collection arrows have a shaded circular surround, visible keyboard focus and reduced-motion behavior. Preserve destinations and file/edit actions; unrelated shared arrows keep their existing asset.

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
