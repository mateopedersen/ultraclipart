# R2 ingestion

`scripts/r2/plan.mjs` provides the tested byte-budget and complete-file-group validator. `scripts/r2/ingest.mjs` supports AWS CLI and the official Cloudflare REST API for a previously approved, activated R2 Standard account. It does not create buckets, activate subscriptions, configure billing or publish artwork.

## Preconditions

1. The owner approves any new R2 subscription before dashboard activation. Use an existing Standard production bucket.
2. Run and review art/export preflight. The uploader checks bytes and basic signatures, not artistic originality or CMYK correctness.
3. Install a recent AWS CLI supporting `s3api put-object --if-none-match`. Set standard AWS credential environment variables privately and `R2_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com`. Never commit credentials.
4. S3 credentials must enumerate every bucket and list its objects across all account jurisdictions. A single endpoint cannot establish account-wide occupancy. The adapter checks `default`, `eu`, `us`, `fedramp`, and `fedramp-high`, as listed by the Cloudflare bucket API schema reviewed on 2026-10-23. The 8 GB budget includes all those buckets and both storage classes, including unrelated objects. A denied, unsupported, incomplete or unknown scope blocks uploads; it is never counted as zero. Review this scope list against the current API before future production waves.
5. Serialize all account uploaders. The local exclusive lock protects one checkout; it cannot stop independent writers on other machines. Do not claim a global transactional storage cap in the presence of concurrent external writers.

The JSON batch is an array of objects with `assetId`, `kind` (`pdf`, `webp`, `thumbnail`, `svg`), `bucket`, `jurisdiction`, `key`, `path`, `bytes`, `sha256`. A missing jurisdiction means `default` for compatibility with existing pilot batches. Non-default targets require an explicit jurisdiction matching `R2_ENDPOINT`; `make-batch.mjs --jurisdiction eu` is one example. Bucket identities include the jurisdiction, so identically named buckets in different scopes are counted independently. Include exactly one of each kind per artwork, at most 50 artworks. Keys must include the first 12 SHA256 characters; paths must point to real files under the current project. Run from the project root.

Build a local batch from hash-verified catalog files (replace `BUCKET` with the real bucket name):

```sh
node scripts/r2/make-batch.mjs BUCKET --output work/r2-batch.json
```

The default includes only already approved/published catalog entries. Add `--ids pumpkin-curly-vine,ghost-teacup` to select a wave. For a deliberate preview upload of the current unapproved pilot, add `--pilot`; this does not change approval status or publish routes. Batch generation has no network access or remote writes.

```sh
node scripts/r2/ingest.mjs work/r2-batch.json
```

This dry run makes read/list requests but no object writes. It measures aggregate occupancy, validates all local sizes and hashes and prints the proposed result. A full inventory JSON may be supplied with `--inventory work/inventory.json` for an offline dry run; it must use schema version 2, carry the full jurisdiction roster and proof metadata, and have begun measurement within 60 seconds. Old single-endpoint snapshots are rejected. Offline snapshots are only planning inputs; they never authorize `--apply`.

```sh
node scripts/r2/ingest.mjs work/r2-batch.json --apply
```

This writes only the reviewed batch using content-addressed keys. S3 conditional creation is enforced by its endpoint; see the REST qualification below. It remeasures every jurisdiction before each artwork, downloads every remote object to verify the full SHA256, and atomically checkpoints `r2-ingest-journal.json`. It never deletes objects. Rerun the same command to resume: existing matching keys are downloaded and reverified instead of reuploaded. A conflicting/unknown existing key fails closed.

Only after all four representations verify is an artwork ID recorded as uploaded. Even a fully uploaded batch has `publishApproved: false`; the content manifest must be separately reviewed for originality, CMYK and metadata before publication. A failed wave may leave objects in storage; they remain counted on the next run. Quarantine/diff them before any later manual deletion.

## Preparing a publication across waves

The uploader's immutable `topic/artwork.kind.sha256-prefix.ext` keys feed the production publisher directly. A schema-2 `data/publication.json` records each representation's exact CDN URL, local source path, byte count, full SHA256 and successful CDN MIME/CORS verification. Existing pilot snapshot URLs remain valid; subsequent waves do not copy or reupload earlier files into a new prefix.

After a successful upload journal and the separate art/export review, prepare a reviewable next manifest:

```sh
node scripts/r2/prepare-publication.mjs --batch work/r2-batch.json --journal r2-ingest-journal.json --output work/publication.next.json
```

This command performs only public CDN reads and a local atomic file write. It never uploads, deletes, changes a subscription, publishes routes or grants editorial approval. The current `data/art.json` must describe the **full next catalog** with four hash-verified local files per artwork. The default prior release is `data/publication.json`; use `--prior` to select another reviewed release or `--initial` only for the first release.

The journal must match the exact batch file SHA256, declare successful complete-object verification, contain all five inventory scopes and stay within the aggregate byte ceiling. Previously verified representations whose local bytes are unchanged retain their exact URLs and verification records. Every new or changed representation needs a matching uploaded entry. The command GETs those new URLs from `https://assets.ultraclipart.com`, rejecting redirects, incorrect MIME types, missing apex CORS access, truncated/oversized bodies or any full-SHA256 mismatch. It rejects the entire next manifest on failure. No partial verified release is written.

Review `work/publication.next.json` together with the full catalog and art preflight, then promote it to `data/publication.json` in the same reviewed change. A Cloudflare Pages production build validates every URL and every local source hash before generating HTML. It selects media from this per-file mapping and removes only those exact verified duplicate build files. Local development and ordinary CI use local source paths. A future wave can therefore add new immutable URLs while leaving all earlier artwork URLs unchanged.

The preparation tests cover two sequential waves, retention of existing pilot URLs, a changed representation, incomplete catalogs/journals and CDN hash/MIME/CORS failures. These use deterministic local responses; they do not certify a live API upload. The existing pilot manifest was migrated from its saved successful CDN verification, preserving all 40 original URLs.

The guard rejects projected totals above **8,000,000,000 bytes** and PDFs above **1,000,000 bytes**; warnings begin at 6.5 and 7.5 GB. This does not cap externally generated Class A/B requests or guarantee a zero bill. Review account operation metrics separately. The journal's CLI call counters are local invocation counts, not authoritative Cloudflare billed-operation totals.

## Verification status

The deterministic budget and jurisdiction validators are unit tested, including cross-jurisdiction occupancy, same-named buckets, missing scopes, API denial, empty-scope proof, pagination and loop rejection. The AWS adapter is tested against a local S3 command double for dry run, conditional creation, full-object verification, idempotent resume and corruption rejection. The S3 adapter uses a deterministic local double. The REST transport was subsequently tested against the live account; see the verified REST section below. The current pilot uploaded through the dashboard is not retroactively certified by this adapter. An incomplete inventory, API error, stale snapshot, changed local file or checksum mismatch aborts the run.

## Inaccessible or disabled jurisdictions

Cloudflare documents that a jurisdiction endpoint cannot access resources outside its scope. Its current bucket-list API additionally enumerates `us` and `fedramp-high`. See the [R2 data-location documentation](https://developers.cloudflare.com/r2/reference/data-location/) and [bucket-list API schema](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/methods/list/).

A successful empty S3 bucket list proves that one scope empty. A `403`, `404`, connectivity failure or “not enabled” error does **not** prove absence. If a jurisdiction's S3 endpoint is inaccessible, the optional command below can obtain a fresh, read-only absence proof:

```sh
node scripts/r2/ingest.mjs work/r2-batch.json --verify-absent-scopes
```

This requires `R2_ACCOUNT_READ_TOKEN` supplied privately by the operator, with **Workers R2 Storage Read** for this account only. No token is created by the script, and there is no account, subscription or payment activation. The flag may also accompany `--apply` after a successful dry run and the existing upload authorization. The token is sent only to the fixed official Cloudflare account bucket-list API, never to a configurable endpoint or a command-line argument; redirect responses are rejected and credential-bearing failures are suppressed.

For each inaccessible scope, the adapter calls the documented `GET /accounts/{account_id}/r2/buckets` endpoint with the corresponding `cf-r2-jurisdiction` header. Only a successful response containing `success: true`, no errors, an empty `result.buckets` array, `result_info.total_count: 0`, and no continuation cursor establishes absence. Proof account, jurisdiction, endpoint and observation time are recorded in the journal. Any nonempty or uncertain result blocks the wave: object-list permission must be obtained for populated scopes. Saved exports, owner assertions and permission errors cannot substitute for the live check during `--apply`.

A measurement older than 60 seconds is rejected, including a scan that took more than 60 seconds. Bucket creation, deletion and independent writes must be serialized throughout each wave; no multi-endpoint scan is an atomic account-wide snapshot. The all-scope guard therefore does not claim a transactional cap against uncoordinated external writers.

## Verified REST transport (2026-10-23)

Use `--transport cloudflare-api` with `R2_ENDPOINT`, `R2_WRITE_BUCKET`, and either an existing `CLOUDFLARE_API_TOKEN` or explicit `WRANGLER_AUTH_FILE`. The tool creates no credential and changes no account permissions or billing. The first 21-drawing wave completed 84 uploads/readbacks and all public CDN checks through this transport.

The account's disabled government-region capability is independently checked through its explicit fresh boolean `r2.fedramp` entitlement. A denied bucket call alone never establishes absence. Enabled, missing, deleted, or unreadable capability evidence stops the run. Bucket counts, all object pages and the full account byte budget remain mandatory.

A live same-bytes conditional-write probe returned HTTP 200: this REST endpoint does **not** enforce `If-None-Match: *`. Do not claim atomic conditional creation for REST. The planner rejects unknown/conflicting existing keys, reuses verified versions, and never intentionally replaces a listed object. All independent writers must be serialized; the local lock only protects this checkout. Use S3 when server-enforced conditional creation is required. The probe reused identical bytes, not different content.

Fresh lists still measure every object's current size before each artwork. A full-SHA256 result can be reused only when the current list's opaque ETag and byte count match a version downloaded and hashed in the same process. Unknown or changed versions are downloaded again. The journal's operation counts are adapter calls, including cached head verification, rather than authoritative billable request totals.

Create a staging wave batch with `node scripts/r2/make-wave-batch.mjs wave_001 BUCKET`; then use the same dry run, apply, readback and separate publication preparation. `prepare-publication.mjs --catalog work/art.next.json` permits review of the complete next catalog before promoting either catalog or manifest.

Readback reuse holds at most 16 MB of downloaded bytes in memory and requires the same freshly listed ETag and size. A new bucket listing clears absent version entries, and a PUT invalidates cached bytes before readback. Already verified groups that add no bytes do not need an additional occupancy scan; every group that may add bytes still requires a fresh complete account scan. Final inventory must contain the complete batch. Read-only initial checksum checks are bounded to four concurrent requests.
