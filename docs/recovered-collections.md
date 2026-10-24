# Recovered raster collections

Recovery creates a new CMYK PDF from a supplied PNG. It does not claim that an original PDF was delivered. Supplied WebP bytes are preserved; newly generated replacements retain their source and prompt privately.

`scripts/import-recovered-collection.mjs --intake PATH` accepts a local reviewed manifest with exactly 50 artworks. The manifest binds the source PNG, screen WebP, independently rendered PDF proof, PDF and thumbnail by full SHA256 and byte count. It records real four-component CMYK inspection, the registered GRACoL output condition, 300 ppi page dimensions, exact alpha verification, bounded encoding error, source pairing and a separate composition review. Pending reviews, duplicate WebP bytes, missing files, unsafe paths, changed bytes and PDFs above 1,000,000 bytes stop staging.

The importer stages local media, a next catalog and one 150-object R2 batch. It never uploads or changes publication. Run the existing R2 dry run, reviewed upload, complete readback and CDN verification, then promote the next catalog and publication manifest together. See [R2 ingestion](r2-ingestion.md).

Keep source archives immutable. Excluded designs and replacement candidates remain outside the public catalog. Recovery audit files record the source and output hashes, print facts and screen-review scope without inventing a human reviewer or physical press proof. The original 110-topic generation queue is separate from supplemental recovery collections.

The headphones recovery includes 49 supplied artworks and one original replacement. All 50 native PDF/WebP pairs and all 50 edited exports were tested before release. Subsequent collections require their own reviewed intake and cannot inherit this approval.
