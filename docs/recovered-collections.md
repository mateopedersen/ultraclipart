# Recovered raster collections

Recovery creates a new CMYK PDF from a supplied PNG. It does not claim that an original PDF was delivered. Supplied WebP bytes are preserved; newly generated replacements retain their source and prompt privately.

`scripts/import-recovered-collection.mjs --intake PATH` accepts a local reviewed manifest with exactly 50 artworks. The manifest binds the source PNG, screen WebP, independently rendered PDF proof, PDF and thumbnail by full SHA256 and byte count. It records real four-component CMYK inspection, the registered GRACoL output condition, 300 ppi page dimensions, exact alpha verification, bounded encoding error, source pairing and a separate composition review. Pending reviews, duplicate WebP bytes, missing files, unsafe paths, changed bytes and PDFs above 1,000,000 bytes stop staging.

The importer stages local media, a next catalog and one 150-object R2 batch. It never uploads or changes publication. Run the existing R2 dry run, reviewed upload, complete readback and CDN verification, then promote the next catalog and publication manifest together. See [R2 ingestion](r2-ingestion.md).

Keep source archives immutable. Excluded designs and replacement candidates remain outside the public catalog. Recovery audit files record the source and output hashes, print facts and screen-review scope without inventing a human reviewer or physical press proof. The original 110-topic generation queue is separate from supplemental recovery collections.

The headphones recovery includes 49 supplied artworks and one original replacement. All 50 native PDF/WebP pairs and all 50 edited exports were tested before release. Subsequent collections require their own reviewed intake and cannot inherit this approval.

The television recovery includes 33 supplied artworks and 17 original replacements. Its 100 native downloads and 100 edited exports passed their own gallery, search, mobile, accessibility and editor checks. Independent PDF preflight confirmed the source CMYK image, output profile and alpha mask survive editing; the largest edited PDF is 979,538 bytes. Screen-rendered proofs were also inspected.

The laptop recovery includes 35 supplied artworks and 15 original replacements. All 100 native downloads and 100 edited exports passed collection and editor checks at four viewport widths. Independent preflight verified the original CMYK image, alpha mask and output-condition metadata remain unchanged in all 50 edited PDFs, with a maximum of 982,203 bytes. Rendered proofs were inspected. Recovery accepts the existing Watercolor style as well as Color, Outline and Black & White; unknown styles still fail validation.

The smartwatch recovery includes 36 supplied artworks and 14 original replacements. Its gallery and editor checks cover all 50 designs, 100 native downloads and 100 edited exports at four viewport widths. Independent preflight and inspected renderings confirmed the CMYK image and alpha survive editing; the largest edited PDF is 981,297 bytes. Descriptions distinguish decorative concept graphics from real device capabilities. SEO checks parse quoted attributes correctly when English descriptions contain apostrophes.

The earbuds recovery includes 40 supplied artworks and 10 original replacements. Chromium and WebKit each passed 100 native downloads and 100 edited exports, with four viewport widths and accessibility checks. Independent preflight confirmed CMYK image and alpha preservation in all 50 edited PDFs; the largest is 972,112 bytes. All native and edited PDF proofs were inspected. Replacement review caught and repaired clipped framing, an incompletely seated jack and an impossible additional cable segment before acceptance.

Production pages identify their source commit for both Git-connected and manual builds. A manual build resolves the current Git HEAD when Cloudflare has not supplied a revision; missing or invalid production revisions stop the build.
