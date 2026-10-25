# Builder choices and responsive workspace

Local refinement, 2026-10-25.

## Choices

The nine Builder selects retain their original IDs and form values. `mountChoicePickers` adds a visible button and uses one shared native dialog. If `showModal` is unavailable, native selects remain visible. A failed dialog open exposes its native control again.

Categories and illustration styles use published catalog reference images, descriptive labels, search and a selected-state check. References illustrate subjects/styles; they are not inference results. Other controls present the existing option values as readable buttons. Only explicit selection dispatches the existing input/change events. Browsing choices does not invoke generation.

The trigger and selection update when the main client changes style, resets a draft, chooses an example or loads history. Busy generation disables choice triggers and rejects option changes. All Styles opens its actual picker. The PDF values are normalized to the existing exporter contract: `letter` and `a4`.

## Responsive layout

- Desktop uses a centered, bounded dialog. Mobile uses a full-width bottom sheet with safe-area padding.
- One interior area scrolls; heading, search and footer stay reachable. Visual viewport height/offset changes are reflected while open, including keyboard and orientation changes.
- Search inputs use 16 px text and touch controls are at least 44 px. Labels wrap and no custom select text shares space with the chevron.
- The dialog supports native Escape/focus management, close button, outside click, arrow/Home/End navigation and explicit focus return. Page scroll position and existing inline scroll styles are restored on closing.
- The owner rejected the subsequent oversized-card redesign and fixed-height workspace, and approved the restored compact arrangement. Desktop keeps two columns and four compact ingredient/style cards per row. The page scrolls naturally; panels have no fixed viewport height, independent scroll area or generation footer covering their content. Mobile uses a single column and two ingredient/style cards per row. Images fit inside their frames and captions remain in normal flow.
- The owner supplied the earlier two-column reference after rejecting the stacked tray arrangement as confusing. Keep the original numbered workflow, compact cards, bold labels and dimensional SVG objects. The named Add Clipart Details action remains below the writing field and keeps its existing handler. Avoid repeated outer borders around every form group.
- Description, subjects, styles, mood/colors and generation now share the left form; preview remains on the right. Mobile reads form then preview with natural page scrolling. Form associations and every original control ID are retained. Desktop example previews use one tall, one wide and two small image areas; mobile uses two columns, and list view has its own row layout. All artwork is contained, with captions and actions in normal flow. No fixed generation footer, independently scrolling workspace or forced panel height is restored.
- The eight original vector objects under `public/illustrations/builder/` use modeled faces, material gradients and grounding shadows. They are vector illustrations with depth, not runtime 3D models; no rendering library or animation loop is added.
- Artwork actions use two equal columns with a separate full-width Share row at every width. View controls, local-edit actions, prompt tools and pagination use explicit columns, wrapping labels and consistent minimum heights. No disabled states or action handlers are changed by alignment rules.

## Evidence and limits

Astro diagnostics and local server markup can establish compilation, source option values and document structure. They do not establish iPhone/Safari interaction or device rendering. Local browser tooling remains unavailable. No generation request, automated test suite or deployment is part of this design update.

## Accent colors

`colors.ts` is shared by the public 32-color palette and composed-prompt descriptions. `color-controls.ts` supports toggling up to five accents, removable selected chips, Clear, a native color picker and custom 3/6-digit HEX entry with or without `#`. Enter adds a valid custom color; Escape restores the last committed entry. Invalid input never changes the selected accents. Busy generation disables the entire color group. Reset, example selection and history loading clear accents through the existing draft reset flow.

Choosing an accent switches the semantic palette to Follow My Description; choosing monochrome clears accents. Colors enter the existing composed prompt and its 1,200-character limit. Selecting colors does not request inference or modify an existing image. The interface explains that generated shades may vary.

## Twenty illustration treatments

`presets.ts` and the actual server/client prompt catalog in `prompt.ts` now include the original 15 styles plus Gouache, Colored Pencil, Woodcut, Clay 3D and Comic. All 20 are available through the searchable choice dialog; four compact references stay visible in the form. The five additions have corresponding published catalog references in `ideas.ts`. Their originals were inspected and source hashes matched. These are visual references and prompt treatments, not guaranteed output replicas.

All Styles opens its dialog without unfolding unrelated generation settings. The native fallback first reveals its containing details. Six balanced quick colors remain visible; More Colors contains the other 26 and the native picker/HEX field. The same 32 unique swatches, five-accent cap, removal/clear, busy guard and prompt composition remain in use. No provider/security/capacity checks were bypassed and no generation was requested.
