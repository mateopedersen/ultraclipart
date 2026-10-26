# Culture, character and technology packages

This release contains 25 supplied archives and 1,250 accepted designs in 22 public
subjects. Disney Hexed shares `/clipart/hexed/`; Sonic shares
`/clipart/sonic-the-hedgehog/`; Angry Birds Movie shares `/clipart/angry-birds/`.
Both trailing-slash forms of each collection alias redirect permanently.

The original archives contained 1,232 designs. Eighteen missing compositions were
drawn with the built-in image generator. Fourteen supplied compositions were replaced
under their existing IDs after visual review found a change limited to material,
plinth, screen, small accessory or the pose of a repeated generic character. Eight malformed PDF image streams were rebuilt
from their unchanged matching WebPs. The remaining 1,218 supplied WebPs retain
their original bytes. Original archive and replaced-file hashes remain in the review.

`data/identification/culture-tech.json` contains the own-scene title, alt,
description, source hash and identity evidence for every entry. Branded records
pass the existing identification validator. Unbranded glasses and home devices do
not acquire a guessed maker or model. Upcoming-film interpretations identify
concepts, and unverified character names are omitted. Primary references and
identity limitations are in `data/research/culture-tech-2026-10-26.json`.

All 2,500 downloads pass independent format, checksum, alpha, size, page and
WebP/PDF-pair checks. Source images are compared with the full current catalog
using file/decoded-image hashes and foreground pHash, followed by actual visual
review of candidates and complete source sheets. These are agent reviews, not
human reviews or guarantees that a similarity algorithm detects every relation.

The 32 new drawings preserve their native lossless WebP pixels. Their separate
print editions use a recorded proportional 850-pixel maximum, or 750 where needed,
with CMYK image data and a truthful smaller page at 300 PPI. The PDF alpha is exact
to that print source, not falsely claimed exact to the larger native WebP. The
print-source hash and dimensions are recorded. Physical prints were not tested.
All 40 authored/rebuilt PDF renders were visually inspected. Supplied valid PDFs
were preserved. The strict one-million-byte PDF ceiling and CMYK quality gate
remain unchanged.

`design-assets/culture-tech/prompt-set.json` records all selected drawing prompts,
workspace source locations, hashes and print dimensions. `scripts/culture-tech-pdf-export.py`
contains the CMYK rebuild and quality gate; `scripts/verify-supplied-package.py`
independently decodes and renders the resulting PDFs. Binary originals remain in
the verified media bucket rather than the Git repository.

Run the staged importer only after all source-topic reviews and duplicate reviews
pass. `scripts/finalize-culture-tech.mjs` promotes this batch only after all 25
upload journals and CDN manifests verify all 3,750 representations. Normal build,
release tests, browser verification and deployment verification still follow.

Ten late generic witch replacements receive a separate 30-object origin/CDN
verification after the initial 25 upload waves. The final publication manifest
supersedes their initial media before any site release. Their actual face,
clothing and activity observations are bound to the new source hashes.
