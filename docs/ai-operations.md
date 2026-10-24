# AI Builder operations and zero-cost boundary

## Release topology

Astro still builds static catalogue, Studio and marketing pages. `scripts/security-headers.mjs` bundles the existing retired-route worker with the small `/api/ai/*` handler. Current static catalogue and Studio routes bypass Functions. Only the generator page permits the Cloudflare Turnstile script/frame/connect origin in CSP. No external inference API, R2 archive, paid fallback, GPU service or queue is configured.

Cloudflare Workers Free was verified in the account dashboard on 2026-10-24. The platform's 10,000-Neuron daily allocation is shared across the account and resets at 00:00 UTC. The account must stay on Workers Free: changing the account to Paid changes Cloudflare's billing boundary. Never enable unified billing, AI Gateway credits or an upgrade as an automated recovery action.

## Runtime configuration

`wrangler.jsonc` declares only public identifiers, AI/D1 bindings and bounded controls. `TURNSTILE_SECRET` and `AI_SESSION_SECRET` are existing-project encrypted production environment secrets, not source files or browser values. The site key is public by design. Preview origins cannot generate because the handler enforces the production origin. Requests cannot select an arbitrary model, remote image URL, size, step count or external provider.

- `AI_GENERATION_ENABLED`: immediate application kill switch.
- `AI_FREE_PLAN_CONFIRMED`: explicit operational assertion; keep disabled until the current account's Free plan is checked.
- `MAX_DAILY_NEURONS`: 6,000 by default, hard-clamped to 7,000.
- `MAX_DAILY_GENERATIONS`: 24 by default.
- `MAX_GENERATIONS_PER_VISITOR`: 2 per UTC day.
- `MAX_CONCURRENT_JOBS`: 2 globally; one active job per visitor.
- Network limit: four generations per daily network hash, plus a 60-second cooldown. Shared networks can reach this limit sooner.
- `AI_MODEL_ALLOWLIST`: only the verified Cloudflare image and translation models.
- `AI_EDIT_ENABLED`: false. No unsupported AI image editing, inpainting or automatic object segmentation is advertised.

Each job first verifies the same-origin request, a signed daily HttpOnly/Secure/SameSite=Strict cookie and a server-verified single-use Turnstile token. A single atomic SQL insertion reserves a conservative 250 Neurons before either bounded model operation. The reservation is retained on errors, cancellation and timeouts. Unknown or unexpectedly high costs close the system rather than grant another free retry. The visitor can still use local editing and downloads when generation is unavailable.

## Privacy and retention

Original prompts go to Cloudflare only on Generate. Images return in a private, no-store response and are never published by the service. The runtime does not log prompts, image bytes or raw addresses. D1 contains day-specific HMAC visitor/network identifiers, job status, timing and cost metadata. Old records are removed after seven days when the API is used; no permanent public image storage is created. Turnstile processes browser verification data under Cloudflare's policy.

Browser history lasts up to seven days and 12 results. Handoffs last one hour. Studio AI workspaces use independent opaque IDs and separate local recovery keys; project exports preserve the generated image and validated provenance. IDs do not expose server-accessible artwork. Download a project for a durable copy. Clearing browser data removes recovery.

## Deployment and rollback

1. Check current Workers plan is Free, inspect the model allowlist, and review current shared account Neuron usage.
2. Apply the checked SQL migrations to the dedicated D1 database.
3. Run formatting, Astro checks, build, unit tests, generator UI contract tests and Studio transfer/extraction tests. UI fixtures must never be reported as fresh model inference.
4. Deploy through the existing GitHub/Cloudflare Pages workflow. Verify the deployed build revision, security headers, non-indexable API, actual production bindings and one real generation within the operator test budget.
5. If generation fails, set `AI_GENERATION_ENABLED=false` in production and redeploy. Static catalogue, existing Studio and downloads remain available.
6. To revert the entire feature, revert its Git merge and rebuild/redeploy. The previous known-good Studio revision is `c50bb5a0fc6bf00abd498afe09faa3c23e369e55`. The dedicated D1 schema is additive and contains no catalogue data. Retained quota metadata can expire during normal use; if permanently retiring the API, arrange deliberate metadata cleanup after its retention period.

Never roll back the quota database to increase a user's allowance. Never replace a failed model result with a catalogue image.

## Known limits

The image model produces native 1024×1024 RGB JPEG. The client can create real alpha by removing edge-connected light background pixels. This is not AI segmentation: fur, white foreground detail, enclosed gaps and shadows require inspection and Studio refinement. Raster outputs are not fully editable vectors. Selection extraction creates actual independent raster layers; model results do not arrive pre-segmented. Lettering is best added as editable Studio text. Translation and image models can miss details, counts, poses and relationships. Generated examples and failed quality cases are documented separately in `docs/ai-models.md`.
