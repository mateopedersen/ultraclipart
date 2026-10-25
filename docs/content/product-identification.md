# Branded-product identification

Inspect every original image before writing metadata for a branded import. Treat the archive name and filename as search clues. Compare distinctive body, door, camera, connector, control or accessory arrangements against current official manufacturer product pages, identification guides or historical manuals. For a newly released product, obtain fresh primary evidence rather than relying on an older knowledge base.

Use the narrowest identity the illustration supports:

- **Recognized product:** name the model, and generation only if visually distinguishable. Do not invent trim, model year, capacity, Pro/Max size, range or compatibility.
- **Product family:** use the recognizable family when the precise model or generation is uncertain.
- **Branded scene:** describe the visible charging, repair, accessory or other activity without inheriting a model from the filename.
- **Imagined concept:** explicitly say concept in the heading and caption for fictional flying, rocket-powered or otherwise speculative configurations. An exploded illustration is not a manufacturer-verified manual.

Retain an identification record containing the artwork ID, actual source-image path and SHA-256, observed distinguishing features, chosen identification level, reviewed identity, official manufacturer references and review date. The checksum must be calculated from the inspected source bytes. Compare it again before ingestion and publication. A missing record or changed source hash requires renewed inspection; do not carry the old review over to a replacement. If an importer provides an identity validator, use it to reject missing or stale records before release.

Use the same reviewed identity in the title/H1, natural image alt, description and ImageObject metadata. Describe the actual visible action and configuration. Do not add physical product specifications based on pixels; downloadable artwork dimensions and PDF print size describe the file, not the product. Do not imply manufacturer endorsement.

Before publishing, inspect the resulting heading, image alt, meta description and image schema on desktop and mobile. Confirm that the downloadable files still match the reviewed source. Record unresolved identity questions privately and withhold unsupported model claims.

## Current implementation

Use `scripts/product-identity.mjs` for future branded importers. Its levels are
`recognized-product`, `product-family`, `brand-scene` and `imagined-concept`.
Only `recognized-product` may carry an exact `model`; keep unsupported generations
and variants empty. The current 150 Tesla, iPhone and Samsung records are stored
in `scripts/remaining-product-identities.json`. Each includes the inspected source
path and SHA-256, visible observations, manufacturer reference and review date.
The 31-pack importer compares the actual WebP hash before accepting its metadata.
A replaced image, missing review or invented exact production model must block release.

An object close-up cannot establish a whole vehicle's trim. A Model X with visible
falcon-wing doors supports its model name, while a charging-port close-up may only
support a charging scene. A flying sports-car illustration must remain a clearly
labeled imagined concept rather than evidence that Tesla sells that configuration.
