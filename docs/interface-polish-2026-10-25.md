# Interface copy and presentation cleanup

Local changes requested on 2026-10-25. This batch is not published.

LATEST OWNER CORRECTION: the owner rejected the flattened homepage AND other
simplified areas. Earlier dimensional displays, glows, badge styling and layered
illustrations are restored from archived source, preserving revised copy, current
prompt handoff, working controls, counts and OG metadata. Shared footer displays
on every page are restored through `site-display-restoration.css`; compact
actions, navigation, footer order and removal of saved-artwork promotion remain.
Studio surfaces, image shadows and rounded displays, homepage card styling and
the header New badge have also been restored. The improved Studio brand label,
inspector, HEX controls, libraries and search remain.

The owner separately requested omission of public production-origin labels.
Removed those phrases from invitation copy/alt text, artwork-origin helper text,
About/License copy and the Builder social cover; neutral example captions replace
them. Functional tool names and accurate service/privacy/license information stay
intact, without claiming handmade authorship. Catalog title/alt/description scans
found zero such phrases; original metadata/source checksums remain untouched.
The removal of ornamentation described below is historical, not current direction.

## Shared select controls

The source inventory found 71 native selects in 11 Astro source files, including shared Editor components. `select-controls.css`, imported by Layout, supplies one same-origin SVG chevron, removes the OS decoration and reserves 42 px at the inline end: 14 px inset, 16 px icon, 12 px text gap. Important declarations protect these limited invariants against the existing component background/padding shorthands. Colors, fonts, dimensions, options, focus and event handlers remain owned by their controls.

- New single-choice selects inherit the contract automatically. Multiple selects and listboxes are excluded.
- Right-to-left controls place the chevron at the other inline end. Forced-color mode restores the system arrow because background images may be suppressed.
- Print controls retain their gradient through `--uc-select-surface-image`. Favorites filters wrap by a sensible minimum width instead of squeezing their labels beside the arrow.
- `public/illustrations/actions/select-chevron.svg` is served locally and is permitted by the existing image policy.

## Public copy and layout

Reviewed shared navigation/footer, home, Studio, AI Builder, Favorites, About, Categories, Collections, topic/collection templates, New Clipart, information pages, 404, Guides and For Teachers. The approved Guides/Teachers typography and real instructional screenshots are retained.

- Replaced promotional slogan fragments with subject names, tasks and descriptions of actual controls. Removed redundant lead slogans from the shared topic template; its detailed subject introduction remains.
- Rebuilt the home display, AI invitation and project invitation with contained image frames, simpler grids and ordinary links. Removed stacked 3D planes, ornamental glows, extra dots and unrelated floating decorations in those areas. Existing brand colors, fonts, actual catalog illustrations and approved icon assets remain.
- Consolidated the home and invitation styles instead of adding another layer of overrides. Removed 57 obsolete AI Builder CSS rules for its retired woodland scene/theme grid, old ingredient controls and concept layout. Removed unused header badge/footer decoration styles and unnecessary external-direction marks on internal links.
- Made category summaries specific to their contents. Kept founder roles and approved portraits while shortening the team biographies. Updated FAQ file/region-editing explanations to reflect raster artwork and the current Studio controls.
- AI remains identified as AI. The homepage examples explicitly state that they were generated with AI, and Builder library pictures remain labeled catalog subject references. No handmade/human-authorship claims were added. Source provenance, licensing, generation/security/quota logic and private project/history data were not rewritten.
- The original source artwork, artwork identity metadata and source checksums remain intact. Public-facing descriptions do not replace the product-identification review required for future branded imports.

## Evidence and limits

- Compiler diagnostics: `/tmp/ultra-site-polish-diagnostics.txt` — zero errors and warnings, with the existing unused-parameter hint.
- Eighteen representative local routes returned HTTP 200, including all seven pages that together render the 71 source select controls, plus home, About, information pages, a subject, artwork detail, Guides and Teachers.
- The shared select stylesheet appears in the rendered page outputs; the SVG returns HTTP 200. Static markup inventories found no duplicate element IDs in these outputs.
- Source scanning found no public debug logging, TODO/FIXME text, placeholder lorem ipsum or assistant self-identification strings in application source. Legitimate AI feature names, tool names such as Magic Wand, source notices and editable example captions were retained.
- This is compiler, source and server-output evidence. No interaction suite or image generation was run. Browser inventory still returned `Local browser use is disabled in Work settings`, so final desktop/mobile layout and interaction could not be visually verified.
