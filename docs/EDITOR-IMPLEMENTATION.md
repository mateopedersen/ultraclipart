# Editor implementation and verification

The native TypeScript editor opens sanitized named SVG groups from the selected illustration. It does not infer layers from a flattened thumbnail. The versioned document stores source markup, layer transforms, paint edits, visibility/locking, linked selections, captions, canvas background, crop and print settings. Changes use immutable 75-step undo/redo history. Browser storage recovery is optional; project JSON files can be saved and reopened for the same illustration.

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
- Native dialog with explicit keyboard focus loop, Escape close, opener focus restoration and cancellation before download if the modal is closed during encoding.

## Export truthfulness

WebP is drawn from the current edited SVG at the requested export dimensions before encoding. This avoids upscaling a 512-pixel raster to 2048 pixels. Native browser encoding is used when supported. Safari/WebKit receives a lazy local libwebp WebAssembly encoder via `@jsquash/webp`. Alpha is retained. No user artwork is uploaded to any external service.

PDF uses actual transformed vector paths with process CMYK paint operations and PDF 1.7 graphics states. A 17-cubed table generated through LittleCMS converts sRGB colors to GRACoL2006_Coated1v2, with trilinear interpolation. Exact neutral colors use only process black. The file references registered output condition CGATS TR 006. The full 2.75 MB ICC profile is available under `/color/print.icc` but is not embedded because it alone exceeds the 1,000,000-byte PDF limit. This output is not represented as PDF/X certified. The final byte count is checked and oversized files fail without reducing quality.

Supported PDF geometry includes paths using M/L/H/V/C/S/Q/T/Z, ellipses, circles, lines, rectangles and polygons with actual inherited transformations. Unsupported paint effects, SVG definitions, unsafe inputs or unsupported PDF characters fail visibly. SVG arc commands/gradients and arbitrary imported vector documents require further adapters and are not silently flattened. Text differences between system Arial and standard Helvetica are disclosed in the UI.

## Reproducible verification

The two editor browser scripts expect an Astro development server at `http://127.0.0.1:4321`. The catalog and SVG-sanitizer integration checks import source modules from that development server. Production smoke testing must exercise the built editor through its public controls.

- `node --test tests/editor.mjs`: seven unit tests cover immutable mixed history, 75 retained steps, locked layers, invalid recovery files, vector conversion, paper geometry and actual CMYK lookup tables.
- `node scripts/test-editor-browser.mjs`: fourteen functional journeys with desktop/tablet/375px screenshots, actual download events, rotation, recolor, keyboard, locks, hidden layers, rename/reorder, captions, undo/redo, recovery, crop, pointer resize and SVG attack rejection. Set `UC_BROWSER=webkit` or `firefox` to change engines. `UC_BROWSER_PATH` optionally selects an existing executable; otherwise use Playwright's installed browser. Set `PLAYWRIGHT_BROWSERS_PATH=work/browsers` for a project-local installation.
- `node scripts/test-editor-catalog.mjs`: exercises the browser's export implementation across the entire pilot, changing rotation, position, opacity, palette and layer visibility before producing each format.
- `python scripts/preflight-editor-exports.py work/editor-evidence/chromium`: opens actual files using pypdf/Pillow, checks CMYK operators/no RGB/no embedded raster, exact paper size, output condition, captions, byte cap, WebP dimensions/alpha and edge alpha values.

Observed local Chromium and WebKit runs passed the fourteen journeys. Firefox's matched executable cannot start on this host (`Could not find profile folder`), including attempts with alternative temporary locations; no Firefox pass is claimed. All results are local observations, not proof of live production behavior. Evidence is in the ignored `work/editor-evidence/` directory. Site-level responsive screenshots and axe checks are maintained by the separate site QA workflow.
