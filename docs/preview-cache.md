# Verified presentation cache for production builds

The 2026-10-27 clean Pages build at source `7ff19d7` exceeded the provider's build
limit while generating presentation derivatives. The checked manual package is
still the bootstrap release. Do not describe a queued or active build as live.

`data/preview-cache-index.json` records existing generated preview bytes. Each key
is `previewIdentity`: both original-image SHA-256 values, the preview version and
the Sharp encoder version. Every derivative has its own SHA-256, byte count and
pixel bounds. This index is a presentation cache, not an image editorial review
or an authority for original downloads.

On production builds only, `preparePreviewAssets` first reuses verified local
files, then may restore indexed bytes from the same site's immutable preview
URLs. All received files are bounded, type/signature/hash checked and written
atomically. The existing original-source checks and publication gate still run.
Wrong or unavailable cache content is never accepted. An absent prior release is
probed once, then normal original-image encoding remains the fallback. Newly added
or replaced source images have different keys and are encoded normally.

The initial index covers 13,784 sources and 64,794 presentation files. After a
reviewed catalog update and its normal build, maintainers can regenerate the index
with `node scripts/build-preview-cache-index.mjs`. This verifies both originals
and all generated files, strips filesystem timestamps and applies the index
atomically. Include its changed file with the corresponding reviewed source update;
never change hashes merely to make a failing cache pass. New content also works
without updating the index, through the normal verified encoder.

The cache is served from existing Pages files. No R2 write, new credentials,
provider, plan, public API, user-data clearing or original image replacement is
introduced. Keep the source catalog, publication manifest, reviews, independent
CDN checks and ordinary production gates intact. Validate a real clean remote
build after the bootstrap release becomes available before calling this fix
verified in production. Cache outages can still force slower original encoding;
that fallback must be reported honestly if it exceeds a hosting limit.
