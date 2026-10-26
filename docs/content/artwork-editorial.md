# Image-specific artwork copy

Owner direction, 2026-10-26. Applies to every current and future UltraClipart import.

Start with the actual image. Write a clear title naming its subject and the detail that distinguishes this composition. Describe the visible scene in natural English: what the subject is doing, how its parts are arranged, and the details a visitor needs to distinguish it from another drawing. A simple object may need one sentence; a complex scene may need several. Do not force every image into the same sentence pattern, word count, or usage paragraph.

Do not turn a filename or drawing prompt into public prose. Do not invent visual details, historical facts, product specifications, expertise, human authorship or personal experience to make copy sound authoritative. Verify named landmarks and branded products against primary sources where needed; follow `product-identification.md` for product identities. Label imagined concepts accurately.

Alt text describes the image concisely. It is not a duplicate title, sales pitch, keyword list or download instruction. Title, H1, alt, image schema, search and related captions must refer to the same reviewed subject. Keep stable artwork IDs, URLs, file bytes and licenses.

File controls already explain downloads. Do not append generic Image/PDF instructions to every description. The user-facing download label is **Image**, not WebP. The actual `.webp` extension, MIME, format facts, file checksums and technical compatibility documentation remain accurate; do not rename a WebP file to another format.

## Review and automatic protection

`data/editorial/reviews.json` holds image-specific copy and observed evidence. Each review binds the inspected source and rendered image hashes, the exact incoming metadata, review date and factual references. A new image, changed source or changed metadata invalidates its prior review. Record at least two real visual observations; do not populate observations without looking at the image. Set `status: reviewed-from-image` only after the visual check.

`scripts/artwork-editorial.mjs` produces the single public copy used by the catalog. Its automatic cleanup removes the exact generic sentences listed in `data/editorial/boilerplate.json`, preserves necessary qualifications through the explicit `sentence-replacements.json` map, and removes a duplicated title prefix from alt text. It does not infer image contents, manufacture alternate wording or assert that a visual review occurred. The imported catalog remains the original audit trail; public copy is resolved centrally.

New or modified entries without a source-matched review fail the normal build. Existing accepted entries are temporarily fingerprinted in `legacy-baseline.json`, explicitly marked **not visually re-reviewed**. This baseline is a migration ledger, not an approval list to extend for new imports. Never add a new ID or refresh a changed fingerprint to bypass the review requirement. Replace legacy entries with real image reviews as they are completed. `npm run content:audit -- --details` reports every remaining review and text issue. Do not claim a full catalog visual review merely because this automated audit passes.

If the system can safely remove known boilerplate, it does. If a semantic correction needs image inspection, it blocks new publication until that review is supplied. It must not silently substitute a guess. Existing qualified concept/fan-art statements and license restrictions are not disposable filler.

Run `npm run content:review -- --topic <slug> --limit 25` to prepare the next missing image reviews. The command checks original image hashes and creates a numbered contact sheet plus an empty review JSON in `work/editorial-review/`. Open every image; use the recorded original path for fine details. Fill `copy`, `observations`, `references` and `reviewedAt`, and set `status` to `reviewed-from-image` only after inspection. Merge the finished records into `data/editorial/reviews.json`, then run the audit and normal checks. Preparation never invents captions, auto-approves evidence or overwrites an existing reviewer draft.

Use `npm run content:apply -- path/to/review.json` to validate a completed batch without writing, then append `--write` to apply it atomically. An invalid, duplicated, unknown, stale or still-pending entry rejects the whole batch. Unrelated reviews remain intact; original paths and sheet numbering are discarded. This is the reusable production workflow for large imports: prepare image evidence in batches, review the actual images and complete specific copy, validate/apply once, then run the normal build. A language or vision model can prepare proposed copy, but it must actually receive the images; filename-only text expansion is not a substitute for image evidence. No paid inference provider is invoked by these commands.

## Search guidance

Topic pages use one concise introduction from `data/editorial/collections.json`. It describes the particular available drawings and helps choose between them. `collection-editorial.mjs` binds the introduction to its topic inventory and source-image examples; missing, duplicated or stale entries stop the build. Keep helpful technical guidance in the shared file guide and image facts, with compact links beside the gallery. Do not restore the removed multi-paragraph SEO sections. Catalog-grounded topic summaries and actual per-image visual reviews are different types of evidence; report each honestly.

Useful original images, accurate nearby text and clear titles matter more than artificially lengthened paragraphs. E-E-A-T is not a reason to invent authors or credentials. No ranking or indexing guarantee is made. References checked for this policy:

- [Google: helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google: descriptive and concise title links](https://developers.google.com/search/docs/appearance/title-link)
- [Google: image landing pages and useful alt text](https://developers.google.com/search/docs/appearance/google-images)
