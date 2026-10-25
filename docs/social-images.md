# Page-specific social images

Local update, 2026-10-25. This batch is not published.

## Design

There are 26 distinct 1200 × 630 PNG covers. Each combines the blue/navy brand,
locally rendered Inter type and content relevant to the destination. They use
existing artwork, the original brand emblem, native vector diagrams and a real
Studio capture. The layout renderer does not call an image model. The Builder cover uses the site's existing robot, teacup and rabbit examples, with neutral example captions under the latest owner direction.
No claim of handmade artwork is added.

The overview is [design-assets/social/overview.png](../design-assets/social/overview.png).
The complete route/image/alt mapping is [data/social-images.json](../data/social-images.json).

| Destination             | Visual content                                                         |
| ----------------------- | ---------------------------------------------------------------------- |
| Homepage                | Fox, floral heart, strawberries and blue butterfly                     |
| Clipart Studio          | Strawberry poster example, text tile and selection handles             |
| AI Clipart Builder      | Gardening robot, floral teacup and rabbit examples                     |
| Categories              | Animals, plants, food, school, music and nature                        |
| Collections             | Halloween, Winter and Hearts covers                                    |
| Black & White           | Original monochrome fern, book and violin illustrations                |
| For Teachers            | Example Earth worksheet and Reading Corner design                      |
| Guides                  | Actual Studio screenshot with download/edit/print guide labels         |
| Print Size Calculator   | Image-to-paper diagram and measuring rulers                            |
| About                   | Blue U emblem, layered heart/fern/lemon art cards, palette and pencil   |
| New Clipart             | Latest published subjects, selected at build time                      |
| Favorites               | Clearly labeled example boards, with no visitor data                   |
| Search                  | Search field illustration and varied subject previews                  |
| Contact                 | Envelope, feedback/questions labels and public email                   |
| FAQ                     | Question mark and image/PDF/editing topics                             |
| Classroom Label guide   | Reading Corner example using the real Learning label starter           |
| Coloring Activity guide | Same editable sprig in color and outline                               |
| Download Formats guide  | Separate WebP, PDF and Project illustrations                           |
| License                 | Personal/educational-use document and catalog examples                 |
| Privacy                 | Lock and distinct browser/AI-service/saved-file labels                 |
| Cookie Policy           | Cookie, security shield and privacy-setting labels                     |
| Terms                   | Site-branded terms document                                            |
| Copyright               | Copyright symbol, document and contact envelope                        |
| Accessibility           | Keyboard keys and visible-focus example, without a certification claim |
| Finding & Using Clipart | Find, edit and save steps                                              |
| 404                     | Blue 404, fox, butterfly and search symbol                             |

Compositions are graphics explaining the page, not invented product screenshots.
The label, worksheet, poster and boards are examples. Existing catalog titles,
product identities, source files and license records are unchanged. Covers avoid
fixed catalog totals.

The owner requested a brand-focused About cover without founders. Its OG/Twitter
image has no portraits, names or roles; the approved portraits remain in the
About page team section. The other 25 cover images retain their approved bytes.

## Rendering and maintenance

- `scripts/social/pages.mjs` defines route-specific headings, alt text and scenes.
- `scripts/social/compositions.mjs` constructs the layouts from actual local assets.
- `scripts/social/render.mjs` renders SVG compositions and text through Sharp.
  A private Fontconfig configuration uses only the project's self-hosted Inter
  400/600/700 files and a writable local cache. It does not scan system fonts.
- `scripts/build-social-images.mjs` renders images before Astro in the normal
  `build` command, after the verified asset-restoration step. `social:build`
  regenerates just the covers and overview when local assets are present.
- Inputs must belong to the project. Catalog sources must be published/indexable;
  their original WebP SHA-256 is checked against the catalog file record. Missing
  subjects or altered originals stop generation. New Clipart selects six recent
  subjects from the same published/indexable catalog.
- `data/social-image-provenance.json` records renderer, font, source and output
  checksums plus the actual text bounds. The bounds must fit within the image.
  This preserves source traceability; it does not create a new branded-product
  identification review or replace existing reviews.
- Generated files use content-hashed names under `public/og/`. Only obsolete
  generated names matching this renderer's naming convention are removed.
  Unrelated or manually supplied files remain intact. `/og/*` has immutable
  caching because a changed image receives a new URL.
- Add a new important page to the route configuration and supply a scene. Do not
  reuse an unrelated cover just to populate a metadata field.

## Metadata

`src/lib/social-images.ts` resolves exact page covers. `Layout.astro` emits one
absolute production HTTPS image URL for both Open Graph and Twitter, including
alt text, image MIME and dimensions, with `summary_large_image`. It also supplies
matching social titles/descriptions, site name and locale. Image structured fields
follow the [Open Graph protocol](https://ogp.me/#structured).

Artwork, subject, collection-detail and artwork-editor pages retain a relevant
original image with its actual dimensions and WebP MIME; they do not inherit the
homepage cover. The 404 template explicitly selects its own cover even when it
is rendered at a missing nested address. Canonical URLs, indexing rules, page
schema, font scope and page appearance remain owned by their existing templates.

The URLs are prepared for the next authorized release. No live crawler refresh,
social-platform cache invalidation or production publication was performed.

## Local evidence

- 26 unique PNGs; all are exactly 1200 × 630; total image payload 953,635 bytes.
- All output/source checksums matched and all rendered text bounds fit.
- Visually inspected the overview plus full-size homepage, About, Builder and
  classroom-label images.
- Read 30 local server responses: 29 HTTP 200 and the expected HTTP 404. All 26
  dedicated OG/Twitter metadata sets matched their files. Four sampled dynamic
  destinations retained their own original artwork and dimensions.
- Astro diagnostics: zero errors, zero warnings, one existing unused-variable
  hint in an unrelated fixture.
- Inventory: [social-images-audit-2026-10-25.json](social-images-audit-2026-10-25.json).
  This is image/static/server-output evidence, not a browser interaction or live
  social-crawler result. No test suite was added or run for this request.
