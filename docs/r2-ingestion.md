# R2 ingestion

`scripts/r2/plan.mjs` provides the tested byte-budget and complete-file-group validator. `scripts/r2/ingest.mjs` is an AWS CLI adapter for a previously approved, activated R2 Standard account. It does not create buckets, activate subscriptions, configure billing or publish artwork.

## Preconditions

1. The owner approves any new R2 subscription before dashboard activation. Use an existing Standard production bucket.
2. Run and review art/export preflight. The uploader checks bytes and basic signatures, not artistic originality or CMYK correctness.
3. Install a recent AWS CLI supporting `s3api put-object --if-none-match`. Set standard AWS credential environment variables privately and `R2_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com`. Never commit credentials.
4. Credentials must enumerate all account buckets and list their objects. The conservative quota includes every enumerated bucket, not only the upload target. If full enumeration is unavailable, the uploader fails closed.
5. Serialize all account uploaders. The local exclusive lock protects one checkout; it cannot stop independent writers on other machines. Do not claim a global transactional storage cap in the presence of concurrent external writers.

The JSON batch is an array of objects with `assetId`, `kind` (`pdf`, `webp`, `thumbnail`, `svg`), `bucket`, `key`, `path`, `bytes`, `sha256`. Include exactly one of each kind per artwork, at most 50 artworks. Keys must include the first 12 SHA256 characters; paths must point to real files under the current project. Run from the project root.

Build a local batch from hash-verified catalog files (replace `BUCKET` with the real bucket name):

```sh
node scripts/r2/make-batch.mjs BUCKET --output work/r2-batch.json
```

The default includes only already approved/published catalog entries. Add `--ids pumpkin-curly-vine,ghost-teacup` to select a wave. For a deliberate preview upload of the current unapproved pilot, add `--pilot`; this does not change approval status or publish routes. Batch generation has no network access or remote writes.

```sh
node scripts/r2/ingest.mjs work/r2-batch.json
```

This dry run makes read/list requests but no object writes. It measures aggregate occupancy, validates all local sizes and hashes and prints the proposed result. A full inventory JSON may be supplied with `--inventory work/inventory.json` for an offline dry run; it must have been measured within 60 seconds and assert complete bucket enumeration.

```sh
node scripts/r2/ingest.mjs work/r2-batch.json --apply
```

This writes only the reviewed batch, using immutable keys and conditional creation. It remeasures aggregate occupancy before each artwork, downloads every remote object to verify the full SHA256, and atomically checkpoints `r2-ingest-journal.json`. It never deletes objects. Rerun the same command to resume: existing matching keys are downloaded and reverified instead of reuploaded. A conflicting/unknown existing key fails closed.

Only after all four representations verify is an artwork ID recorded as uploaded. Even a fully uploaded batch has `publishApproved: false`; the content manifest must be separately reviewed for originality, CMYK and metadata before publication. A failed wave may leave objects in storage; they remain counted on the next run. Quarantine/diff them before any later manual deletion.

The guard rejects projected totals above **8,000,000,000 bytes** and PDFs above **1,000,000 bytes**; warnings begin at 6.5 and 7.5 GB. This does not cap externally generated Class A/B requests or guarantee a zero bill. Review account operation metrics separately. The journal's CLI call counters are local invocation counts, not authoritative Cloudflare billed-operation totals.

## Verification status

The deterministic budget validator is unit tested. The AWS adapter is tested against a local S3 command double for dry run, conditional creation, full-object verification, idempotent resume and corruption rejection. It still requires integration testing against the authorized account; no R2 network writes are implied by these tests. An incomplete inventory, API error, stale snapshot, changed local file or checksum mismatch aborts the run.
