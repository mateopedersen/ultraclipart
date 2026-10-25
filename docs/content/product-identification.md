# Identify branded subjects before writing metadata

Owner preference, 2026-10-25; applies to every UltraClipart import and branded-product package.

- Inspect the original image and compare distinctive features with current official manufacturer sources before writing the title/H1, alt or description.
- Use a model and generation only when the evidence supports them. Use the recognizable product family when greater precision is not supported.
- Never infer model, trim, year, capacity or specifications from a filename, color or brand alone. Verify newly released products against current primary sources.
- Label fictional flying cars, rocket systems and other imagined designs as concepts. Do not describe speculative artwork as a released or technically verified product.
- Keep wording natural, specific to visible features and useful to clipart users. Keep the reviewed identity consistent across heading, alt, description and image schema.
- Bind each identification review to the original image's SHA-256, record the reviewed identity and official source URLs, and record the review date. A replacement image with a different checksum requires a new review before reusing its identity metadata.
- Search consumes reviewed metadata; search aliases and rankings must not rewrite or infer product identities.

## Current importer checks

Use `scripts/product-identity.mjs` for branded imports. Its review levels are
`recognized-product`, `product-family`, `brand-scene` and `imagined-concept`.
Only `recognized-product` may carry an exact model. The reviewed Tesla, iPhone
and Samsung examples are in `scripts/remaining-product-identities.json`, each
bound to its inspected source image checksum and official reference. The importer
must reject a missing review or changed source image.
