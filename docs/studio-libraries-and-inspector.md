# Studio libraries and inspector

## Artwork library

`src/lib/studio-artwork.ts` chooses up to 500 published raster originals. It balances the selection across subjects, ordering each subject by publication date and preferring color artwork before monochrome alternatives on the same date. No new artwork IDs or duplicate files are invented to reach the total. The current selection covers all 164 populated subjects.

`studio-catalog.json` preserves every original verified source representation and adds a featured flag, publication date and audited monochrome status. The artwork library opens on Featured, with All Artwork still available. Searching or changing a subject/style switches to the full catalog. Sorting, clearing filters, page navigation and visible add status use actual current results. Only 24 preview cards are mounted per page; originals load after an explicit add action. Existing raster source hash/MIME/dimension checks remain in place.

The create-page featured count and the library count derive from the real selection. The full library remains 8,200 artworks in this audit; neither counter is a manually maintained public claim.

## Vector library

The original 276 elements and their IDs remain intact. An additional 1,724 geometrically distinct icons bring the total to 2,000, across 38 categories. IDs, names and exact vector markups are all unique. The new assets include nature, food, travel, buildings, health, sports, games, weather, devices, school, communication, design and household subjects. Recommended ordering interleaves the existing illustrations and new icons; category, search, favorites, A–Z sorting and 24-item pagination are available.

The source is the official `@tabler/icons` 3.49.0 package, from the Tabler Icons project:

- [Official SVG usage and metadata](https://github.com/tabler/tabler-icons/blob/main/packages/icons/README.md)
- [MIT license](https://github.com/tabler/tabler-icons/blob/main/LICENSE)

The subset excludes brand categories and disabled/numbered variants and prefers filled SVGs where available. It is not a set of color/size copies. Original SVG bytes, source paths, archive SHA-256 and npm SHA-512 integrity are recorded in `data/studio-vector-provenance.json`. The importer checks the pinned package integrity before reading it, accepts only supported primitives/attributes, resolves `currentColor`, removes invisible bounds paths, and normalizes the 24px geometry into the existing 256px element space. It adds no runtime package or external network dependency.

To reproduce the reviewed subset, download that exact official package and run `python3 scripts/build-studio-icon-pack.py /path/to/icons-3.49.0.tgz`. Ordinary builds use the checked JSON and do not download icons.

The full MIT notice is kept in the deployed license file, License page and each imported vector's nonvisual `desc`. Editable projects keep it, including after Separate Parts. Original catalog usage terms do not replace the separate MIT terms. The product's existing document safeguards (including its 500-layer limit) are unchanged; a 2,000-item library is not a 2,000-layer document.

## Inspector

The shared inspector now has a persistent header/tool selector, one scrollable content area, and persistent View Canvas / Layers / Download controls. Selection context stays visible. Existing editing data attributes, undo/recovery keys, export actions and source validation are preserved. Canonical toolbar controls remain unique; footer shortcuts call their existing actions.

The Select & Recolor pane groups image selection, area tools, color/method, saving and advanced options. Smart Select, Wand, Brush and Lasso have direct buttons; the complete tool list and edge/coordinate controls remain available. No-image guidance replaces the empty source selector and unavailable controls are disabled. The general Recolor pane links directly to regional editing for raster layers.

The panel uses the visual viewport height, responds to the mobile keyboard, and has a single body scroll surface. On narrow screens, tool selection reveals the inspector and View Canvas returns focus to the canvas. Hide/Show removes the body from navigation while preserving its values and actions. Native ranges show their current values. Tool labels use a lighter, compact font weight and existing site colors/fonts.

## HEX entry

`src/editor/color-fields.ts` wraps every existing native color control with a matching HEX field. It accepts `#ABC`, `ABC`, `#AABBCC` and `AABBCC`, normalizes valid input to six digits, previews through existing color input events and commits through existing change handlers. It does not create a separate editor state. Invalid committed input restores the last committed picker/preview and shows an inline message; Escape restores that color. Background presets and selection/undo redraws synchronize the fields. Existing Apply/Update buttons retain their meaning for vector/text tools.

References: [MDN color input](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/color), [MDN viewport units](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length#relative_length_units_based_on_viewport).

## Local evidence — 2026-10-25

`studio-library-audit-2026-10-25.json` records the actual counts. The official package integrity matched its npm metadata. A contact sheet of imported SVGs was rendered and inspected. The create page and studio catalog compile and respond locally; Astro diagnostics reported zero errors and zero warnings, with one existing unused-parameter hint. Existing element-test fixtures were adjusted for the larger library without running their suites.

Browser access still returns “Local browser use is disabled in Work settings.” Desktop/mobile interaction, pixel layout and export behavior have not been verified in a real browser for this revision. Do not present the static/content checks as browser test results. Changes remain local until the owner explicitly authorizes publication.


## Expanded text library

`text-styles.ts` defines 60 treatments across ten collections: Headings, Editorial, Retro, Outlined, Stickers, Curved, Seals, Labels, Typewriter and Playful. Each records actual font-family choice, weight, color, size and typography parameters. These are editable styles, not additional font-family installations. The collapsible style picker keeps writing/apply controls close at hand. Search/category filters paginate 12 cards; choosing one closes the picker and returns focus to Apply. The cards render through `textNodes`, including arc/circle, outline and shadow geometry. A style preserves typed words, populates the controls and is applied using Add / Update or Add as New. New text is measured with the same SVG renderer, centered and proportionally fitted inside the active crop/canvas. PDF standard-font limitations remain explicit.

## Studio Pro workspaces

A searchable directory offers 16 tools in Design, Artwork and Print. Existing tool data attributes and actions remain supported. Five new workspaces use `smart/pro-tools.ts`:

- **Radial & Spiral:** 2–48 grouped copies, radius, sweep, starting angle and tangent/upright orientation. Can keep the source or replace it. The arrangement fits inside the canvas, preserving editable source layers and icon rights metadata.
- **Auto Layout:** selected visible unlocked items, treating complete linked groups as units; proportional cell fitting with configurable columns, gaps and margins.
- **Background Workshop:** dots, checks, stripes, diamonds, confetti, graph paper, rounded and double frames. One editable vector layer at the back. Apply replaces the previous Studio background; locked backgrounds require unlocking. Native color/HEX controls use the shared helper.
- **Canvas Fit:** square, portrait, story, landscape, A4 and Letter; or trim to visible artwork with padding. Proportional transforms also keep hidden alternate layers aligned. Requires unlocked layers, clears the crop and explains that full-canvas Studio backgrounds must be regenerated.
- **Canvas Review:** document dimensions, hidden/visible counts, boundary overflow, source enlargement and PDF text-proof reminders. Bounds use each layer's SVG viewport, including paper preview. Report text is constructed as text nodes and reviewed explicitly after edits. It is not an automated printing-quality guarantee.

New actions validate document, markup, geometry, 500 layers and 16 MB limits before the existing commit/history path. Existing source verification, maximum unique images and vector-node limits stay active. No automatic publication.

## Varied starting designs and tutorial

The starter gallery now contains 18 compositions in seven categories: Technology & Games, School & Reading, Music & Film, Sports, Cards & Family, Nature & Travel, and Animals & Food. Twelve new designs introduce a study desk, music practice, school supplies, an imaginary robot, basketball, a Father's Day card, a movie night, Earth Day, a seaside postcard, arcade controls, a reading corner and a floral greeting. The six previous IDs and layouts remain available. Originals were inspected and their SHA-256 values matched the existing approved catalog records. Generic product families remain generic; no new branded-model identity was inferred.

Each card has a category, title and its own practical description. Per-card image/text quantities were removed at the owner's request; category labels use weight 700. Filters and text search are progressive enhancement, and Show More adds complete groups for the current layout: nine at three columns, six at two, three at one. Without JavaScript all 18 remain visible. The original scene loader, verified originals and undo path are unchanged. New server-render guards reject placements outside the original 1400 × 1000 canvas. Scene descriptions and categories are included in public site search.

The welcome uses one heading, three live library counts and two equal-sized actions. Its laptop, imaginary robot and guitar occupy unframed grid areas, with their full images contained and lower edges aligned. Both the intermediate overlapping arrangement and the later individual white cards were rejected. The project title, privacy link and existing command buttons now share a compact header; the duplicate brand/Your Workspace bars are removed. Page copy has stronger contrast and weight, consistent section edges and regular spacing.

`StudioWalkthrough.astro` explains finding artwork, arranging layers/text/colors, and saving/exporting in three detailed steps. It combines published catalog examples with separately labeled, clickable crops of genuine existing screenshots. The original screenshots are not altered and the artwork examples are not presented as captured UI. Instructions match the current Elements, Text, Layers, Print and project controls. Footer actions share a bottom position; the underlined secondary links are semibold and use the same text inset as the main buttons, including border width.

Local rendering produced a contact sheet of all 12 new compositions; their subjects were fully inside the canvas. Static page inventory found 18 unique starters and no missing local image paths or duplicate IDs. Astro diagnostics reported zero errors and warnings. Browser tooling remains unavailable; interactive desktop/mobile behavior and exports are not claimed as verified. No tests or deployment were run for this visual refinement.
