# UltraClipart owner instructions

These persistent owner preferences apply to every UltraClipart chat and checkout.

## Identify branded subjects before writing metadata

For cars, vehicles, devices, appliances and other branded products, inspect the original image and compare distinctive visible features with current official manufacturer sources before writing the title/H1, image alt or description. Use the correct model and generation only when the evidence supports them. A filename, color or brand alone is not identification evidence. Do not infer trims, years, capacities or technical specifications from an illustration.

When only the product family is recognizable, use that family. Explicitly label fictional flying cars, rocket systems and other imagined configurations as concepts. Do not imply a speculative illustration is a released product or a manufacturer-verified technical diagram. Verify newly released products using fresh primary sources.

Read `docs/content/product-identification.md` before branded imports. Bind each identification review to the actual source image's SHA-256 so replacing the image invalidates its previous review. Apply the reviewed identity consistently to the heading, alt, description and image schema. Keep metadata natural, visible-subject-specific and useful to clipart users.

The reusable implementation is `scripts/product-identity.mjs`. The 150 reviewed
Tesla, iPhone and Samsung examples are in `scripts/remaining-product-identities.json`.
New branded importers must pass the actual source checksum to the validator before
release; changing an image requires a new identity review.

## Pages growth warning

The owner requests a warning when the production Cloudflare Pages deployment
reaches 85,000 files, before the 100,000-file ceiling. Count actual deployment
files after production exclusions and verified R2 offload, not artwork records,
URLs or R2 media objects. Check the count during every publication. At or above
85,000, notify the owner with the verified count and release revision and recommend
completing the R2/Workers catalog transition before further growth. Do not buy a
plan or change the architecture automatically. A daily thread monitor named
"UltraClipart 85.000 dosya eşiği" also tracks this threshold.

## Every keyword requires distinct compositions

Persistent owner preference reaffirmed 2026-10-25: every published clipart must have a meaningfully different composition and useful purpose. Do not count a redraw, repair, crop/framing correction, recolor, export format or near-identical pose as a new original design. Repair versions keep the same artwork ID and creative brief; select and publish only one reviewed version, retaining rejected sources privately.

Before each keyword, review its existing published, staged and queued artwork. Plan new compositions against all three. Before release, check exact download checksums and perceptual similarity both within the incoming collection and against the entire catalog. Visually inspect similarity candidates and repeated concepts; do not treat a filename change or a low perceptual match alone as proof of originality. Reuse the existing topic URL and do not create duplicate collection pages. Every accepted source must map to exactly one WebP/PDF pair and one artwork entry; count unique accepted artwork IDs only. Keep this rule for Labubu and every future keyword.

## Generic characters need different identities and clothing

Owner preference reaffirmed 2026-10-26: scenario changes alone are insufficient. In Scarecrow and future generic character topics, plan visible variation in face shape, facial features and expression, hair or straw construction, headwear, clothing silhouette, materials, footwear and accessories. Do not repeat the same button-eyed burlap face, sunflower straw hat, plaid shirt and denim overalls across every design. Color swaps alone do not satisfy this preference. Use a character-design matrix and inspect the actual sources together before release. Revisions keep their artwork ID and never add to the original count. For branded characters, preserve their identifying features and use appropriate expression, pose, costume and scenario variation instead of changing identity or mislabeling another character.

The target for every keyword is 50 independent, separately useful cliparts, not 50 variants of one visual base. Vary palettes together with silhouette, clothing, material, face and composition as applicable. Apply the same reasoning to objects and botanical topics, preserving accurate subject identity. Review all selected designs side by side and replace repeated base silhouettes, outfits or concepts; alternate colors or rendering media alone are insufficient.
