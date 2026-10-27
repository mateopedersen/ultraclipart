# Source-bound artwork writing

Inspect the actual original pixels before writing a title/H1, alt or description.
Name the visible subject, action and distinguishing composition in natural English.
Do not expand filenames into facts, append repeated download/use paragraphs or
invent product specifications, authorship, credentials or real events. Follow
`product-identification.md` for branded subjects and concepts. Keep file actions
labeled Image while retaining actual extensions, MIME, bytes and checksums.

`data/editorial/reviews.json` is the shared array registry. Each completed review
binds its copy and concrete observed details to the current original and rendered
image hashes, incoming metadata signature, review date and necessary primary
references. Replacement pixels or metadata invalidate the old review. The central
catalog resolver supplies the same reviewed subject to headings, alt, descriptions,
image schema, search and related cards.

Use `npm run content:review -- --topic <slug> --limit 25` to prepare numbered
source-image sheets and a pending review batch. Open every sheet and the originals
needed for small details. Fill the proposed copy and at least two actual visual
observations; mark `reviewed-from-image` only after receiving the pixels. Preparation
does not infer image contents or invoke paid inference.

Run `npm run content:apply -- path/to/review.json` to validate a completed batch,
then add `--write` for atomic application. Invalid, duplicated, stale or pending
records reject the entire batch; unrelated reviews remain intact. Run
`npm run content:audit` and the normal release checks afterward.

The unchanged 13,004-entry `legacy-baseline.json` is a finite migration fingerprint
ledger, not a fresh visual review. Never add IDs or refresh changed fingerprints
to bypass validation. All later or changed artwork in every topic needs a real
source-bound review. This release preserves legacy public prose; it does not apply
the separate catalog-audit checkout's unfinished cleanup. Report that backlog
honestly rather than calling an automated pass a full-catalog visual review.

New topics require short, unique, inventory-bound introductions in
`data/editorial/*-collection.json`, `*-collections.json` or the shared
`collections.json` registry. Describe the actual available drawings without long
repeated SEO, technical, licensing or editor paragraphs. Changed topic inventories
invalidate those records. Existing accepted concurrent records must be preserved.

There is no promised Google ranking, preferred word count or invented expertise
score. Useful original images, accurate nearby text and clear titles take priority.
