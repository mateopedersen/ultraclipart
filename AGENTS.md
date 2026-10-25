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
