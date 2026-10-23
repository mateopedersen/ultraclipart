# Editor implementation and verification

The native TypeScript editor opens sanitized named SVG groups from the selected illustration. It does not infer layers from a flattened thumbnail. The versioned document stores source markup, layer transforms, paint edits, visibility/locking, linked selections, captions, canvas background, crop and print settings. Changes use immutable 75-step undo/redo history. Browser storage recovery is optional; project JSON files can be saved and reopened for the same illustration. The creation studio can also open a saved catalog project as a new local composition.

## Creation studio

`/create/` opens a real blank 800 × 800 document without an artwork fetch. Eight parametric SVG primitives/compositions (rectangle, rounded rectangle, ellipse, star, polygon, line, speech bubble and heart) use editable layers. Shape dimensions, polygon/star points, corner roundness, fill and stroke are explicit controls. Freehand mouse/pen/touch gestures produce bounded native cubic paths, at most 2,000 points per stroke; unfinished Escape/pointer-cancel gestures never enter history. Captions, linked selections, exact transforms and ordinary layer tools operate on created work. Canvas resizing supports 64–4,096 units per side and preserves shape size.

Six original starting compositions (79 named layers collectively) load from `/studio/`, separately from catalog art and catalog counts. A replacement is undoable. Pending source requests are cancelled by a newer source, Reset, Undo/Redo, an edit or Export; late responses cannot overwrite that choice.

SVG import reads the selected file in the browser, at most 1,000,000 bytes, 500 top-level layers and 10,000 total SVG elements. It accepts finite basic shapes, supported paths and solid colors, preserving viewBox origin, root transformations and inherited paints. Scripts, event attributes, external resources, images/fonts, definitions, effects and unsupported paths are rejected with a visible explanation. Nesting is capped at 64; composed transforms and geometry are bounded. Saved projects receive the same geometry/safety validation and an aggregate 10,000-element budget on commit, import and recovery. Canvas and crop dimensions cannot underflow or overflow print calculations. A rejected change leaves the previous work intact.

## Implemented interactions

- Pointer selection and Shift multi-selection; keyboard selection in the labeled Layers panel.
- Pointer movement with optional grid snapping, eight resize handles, rotation handle, exact numeric movement/scale/angle, proportional resizing, center, duplicate and delete.
- Center-preserving rotation for individual or linked selections. Linked selection transforms preserve relative placement.
- Named-layer recoloring, matching-color selection, hex validation, shape opacity, stroke width, original/pastel/grayscale/vintage/bright presets, and genuine black/white vector outline conversion.
- Transparent, white, soft blue, sage or custom background. The transparency checkerboard never enters the export.
- Layer hide/show, lock/unlock, rename, z-order changes, linked selection, unlinking and duplication. Locked/hidden layers are protected from editing commands.
- Multiline captions with size, weight, alignment and color. SVG/WebP use an Arial-compatible system sans serif; PDF uses standard Helvetica and explicitly limits captions to supported Latin characters.
- Non-destructive numeric crop and crop reset; local saved-project import. Arbitrary raster uploads and automatic background removal are not advertised.
- Zoom, fit, mouse/touch pan, keyboard pan, letter/A4 paper preview, portrait/landscape, margins and fit/fill/actual scale.
- Native dialog with explicit keyboard focus loop, Escape close, opener focus restoration and a generation token that prevents an old encoding job from downloading or updating status in a later dialog session.

## Export truthfulness

WebP is drawn from the current edited SVG at the requested export dimensions before encoding. This avoids upscaling a 512-pixel raster to 2048 pixels. Native browser encoding is used when supported. Safari/WebKit receives a lazy local libwebp WebAssembly encoder via `@jsquash/webp`. Alpha is retained. No user artwork is uploaded to any external service.

PDF uses actual transformed vector paths with process CMYK paint operations and PDF 1.7 graphics states. A 17-cubed table generated through LittleCMS converts sRGB colors to GRACoL2006_Coated1v2, with trilinear interpolation. Exact neutral colors use only process black. The file references registered output condition CGATS TR 006. The full 2.75 MB ICC profile is available under `/color/print.icc` but is not embedded because it alone exceeds the 1,000,000-byte PDF limit. This output is not represented as PDF/X certified. The final byte count is checked and oversized files fail without reducing quality.

Supported PDF geometry includes paths using M/L/H/V/C/S/Q/T/Z, ellipses, circles, lines, rectangles and polygons with actual inherited transformations. Unsupported paint effects, SVG definitions, unsafe inputs or unsupported PDF characters fail visibly. The creator accepts supported solid-color SVG vectors. Arc commands, gradients, masks, embedded images and text within imported SVGs require further adapters and are explicitly rejected, never silently flattened. Explicit zero rectangle radii retain square SVG corners in PDF. Export also independently checks numeric geometry and combined transform bounds before serialization. Text differences between system Arial and standard Helvetica are disclosed in the UI.

## Reproducible verification

Public UI scripts accept `UC_BASE_URL`; default ports differ by script and can be overridden. `UC_BROWSER` selects Chromium, WebKit or Firefox, `UC_BROWSER_PATH` optionally chooses an executable, and `UC_EVIDENCE_DIR` selects the evidence directory. `PLAYWRIGHT_BROWSERS_PATH` can select a project-local installation.

- `node --test tests/editor.mjs tests/creation.mjs`: 14 focused tests cover immutable history, bounded recovery documents, source geometry, shape diversity and parameters, bounded smooth freehand, exact SVG rectangle-radius semantics, paper geometry and real CMYK lookup tables.
- `node scripts/test-editor-browser.mjs`: 15 existing catalog-editor journeys, including real saved-project round trips, matching recolor, transforms, keyboard, locks, layers, captions, crop, pointer resize, unsafe-file rejection and actual downloads. This suite now uses public editor controls and is usable against a built site.
- `node tests/e2e/creator.mjs`: blank canvas, all eight shapes, fill/stroke, exact undo/redo, freehand completion and cancellation, resize, text, linked selections, local recovery, save/reopen, safe/unsafe SVG import, all six starters, stale-source cancellation versus newer source/Reset/Undo/new shape, bounded saved-project rejection, stale export-session rejection, responsive overflow and axe checks. It produces 16 actual downloaded files per engine: authored art, an imported vector and six starters, each as PDF and WebP.
- `node scripts/test-production-csp.mjs`: confirms the real production CSP allows the editor and WebKit's local WebP WASM encoder. Optional origin replay supports production CDN CORS checks.
- `node scripts/test-editor-catalog.mjs`: broader pilot export matrix, using its documented development module adapter. It is separate from the public production journeys.
- `python scripts/preflight-editor-exports.py work/editor-evidence/chromium`: independent pypdf/Pillow checks for catalog journey outputs. Creator outputs receive a separate independent preflight covering CMYK paint, no RGB/raster, output condition, numeric validity, byte limit and WebP dimensions/alpha.

Local Chromium and WebKit results and exact test scope are recorded in the verification reports. Firefox's matched executable previously failed to start on this macOS host (`Could not find profile folder`); no Firefox pass is claimed. CI includes all three engines on its supported runner. Local evidence must not be described as live production verification; live checks are recorded separately after deployment.
