# AI model evidence and operating limits

Verified on 2026-10-24. This document records measured behavior; it does not promise exact instruction following or parity with another image product.

## Active image model

`@cf/black-forest-labs/flux-1-schnell`, served through Cloudflare Workers AI. The verified account API input schema allows only `prompt` (1–2,048 characters) and `steps` (maximum 8). Production uses 4 steps. The service returned a 1,024 × 1,024 JPEG with no alpha channel. Seed, negative prompt, dimensions, reference images and edit strength are not exposed as functioning controls. See [Cloudflare's model documentation](https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/).

Black Forest Labs publishes the model under [Apache 2.0](https://github.com/black-forest-labs/flux/blob/main/model_licenses/LICENSE-FLUX1-schnell). No model weights are distributed with UltraClipart. The [publisher's model card](https://huggingface.co/black-forest-labs/FLUX.1-schnell) describes prompt-following limitations and prohibited abusive uses. A model license does not establish copyright, exclusivity, third-party clearance, commercial suitability, or guaranteed rights in a generated image. UltraClipart's catalogue license and its AI-output explanation must remain distinct. Cloudflare's applicable [service terms](https://www.cloudflare.com/service-specific-terms-application-services/) also apply.

## Measured free inference

The original rabbit proof and 12 additional, sequential quality requests all returned HTTP 200. Every response included `cf-ai-neurons: 172.80`; each used the same model and 4 steps. Total recorded image inference: **2,246.40 Neurons for 13 outputs**. No automatic retries or paid fallback were used. Median duration of the 12-case batch was approximately 1.24 seconds; the first independent proof took 5.29 seconds. These are observed request times, not a latency guarantee.

Cloudflare's [current pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) provides **10,000 Neurons per account per day** on Workers Free, resetting at 00:00 UTC (03:00 Türkiye). Free-plan calls fail when the allowance is exhausted; upgrading is a separate action that this feature does not perform. At the measured settings, 10,000 Neurons covers at most 57 image requests before other account usage. An application budget of 6,000 Neurons permits at most 34 images before any additional prompt-processing cost. Reservation, failed-call accounting and buffers intentionally reduce available capacity. Account-wide usage from other applications shares the same allowance. Never equate 10,000 Neurons with 10,000 images.

The image pricing table's tile/step wording is less useful for this integration than the observed response header. Use a conservative reservation at least as high as the measured amount; recheck after a model/step change. A future account upgrade must not silently enable a paid provider or automatic overage path.

## Quality suite

Evidence is retained locally in `work/ai-builder/proof.json`, `work/ai-builder/quality/manifest.json`, `contact-sheet.png`, and `visual-review.json`. All outputs are actual provider responses, not stock substitutions. The suite covers animals, Halloween, school, baby, technology, line art, multiple objects, black and white, stickers, pastels, lettering, and negative space.

| Case | Observed result |
| --- | --- |
| Fox | Strong detailed illustration and margins |
| Halloween kitten | Good subject; some accessory details differ |
| School bus | Detailed red bus; requested exact side view not followed |
| Turkish baby deer | Failed semantic match: unrelated anatomy diagram |
| Robot | Strong materials and potted-plant composition |
| Astronaut dinosaur | Clear, usable line art |
| Three school objects | Three objects, but notebook representation poor |
| Botanical ink | Clean linework; requested counts not followed |
| Corgi sticker | Clear character; less realistic than requested |
| Floral teacup | Strong detailed pastel illustration |
| Letter A | Readable in this sample; still raster typography |
| Negative space | Appropriate empty area for later text |

Direct non-English input is not reliably understood by this image model. The Turkish failure is retained as evidence and must not be hidden by claiming all tests passed. An implemented translation step needs its own real tests and quota accounting. Counts, typography and exact layouts need review. The editor can add real editable text and extract selected raster regions; model output is not automatically separated into independent vector objects.

The three public examples (`public/ai-examples/`) are the actual rabbit, robot and floral-teacup outputs, resized to 320 and 640 pixels and encoded as WebP. They contain a real white background and no alpha. Combined payload is 28,340 bytes for the three 320-pixel versions and 72,730 bytes for the 640-pixel versions. Label them as examples. Transparent output requires genuine post-processing.

## Data handling basis

[Cloudflare's Workers AI data policy](https://developers.cloudflare.com/workers-ai/platform/data-usage/) says standard inference processes inputs/outputs for delivery, does not use customer content for model training, and has qualified retention commitments with operational/security exceptions. Do not promise that requests never leave the device or that no provider metadata exists. Prompts go to Cloudflare when the user generates. Local editing and local history are separate browser operations. No remote public result gallery or R2 result archive is required.

## Baseline performance

`work/ai-builder/quality/performance-before.json` records three cold-cache runs per device against live revision `c50bb5a0fc6bf00abd498afe09faa3c23e369e55`. Median homepage LCP: desktop **464 ms**, emulated mobile **720 ms**; CLS **0** for both; transferred page payload **88,270 bytes**. All six responses were 200 with no JavaScript errors or horizontal overflow. Mobile used 4× CPU throttling and 1.6 Mbps / 150 ms network emulation. These are laboratory measurements from this machine, not field Core Web Vitals or INP. Compare using the same script and setup after deployment.

## Additional translation proof

A further authorized bounded test used `@cf/meta/llama-3.1-8b-instruct-fp8-fast` with `temperature: 0`, `max_tokens: 512` and the provider's real JSON-schema response mode. Three text calls consumed 2.96, 1.72 and 2.64 Neurons. One image using the translated deer description consumed 172.80. **Cumulative operator proof usage is 2,426.52 Neurons: 14 images and 3 text calls.** This excludes any later production smoke tests.

The Turkish description now produced a recognizable, detailed baby deer with spots and four visible legs. Translation omitted some original style/margin/no-text instructions, so it is a useful assistance step, not a promise of perfect semantic preservation. The structured result is available as an object in `result.response`; this provider also returned an OpenAI-style `choices` envelope and reported its routed implementation as `@cf/meta/llama-3.1-8b-fast-v2`. Always validate the actual response instead of assuming a string.

The injection test **failed the model-only safety check**: it returned `allowed: true` with an HTML script string after being told to ignore its translation rules. The frontend must render all prompts as text. The server must independently reject executable markup / instruction overrides and validate the translated output; a model's `allowed` field is not a trustworthy security boundary. The family-appropriate classroom prompt passed. These adversarial results are retained in `work/ai-builder/quality/translation-report.json`.

Llama 3.1 uses the [Llama 3.1 Community License](https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct/blob/main/LICENSE), not Apache or MIT. Its attribution requirement includes **Built with Llama** on a related interface/site/documentation, and its acceptable-use policy applies. The [official model card](https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct) lists eight supported languages; Turkish is outside that published list. A successful Turkish sample does not establish broad language support. No model weights are bundled here.

## Cutout quality check

The actual `src/ai/cutout.worker.ts` algorithm was executed against four real model images. At tolerance 28, it produced genuine transparent pixels on all four images: rabbit 67.45%, robot 53.28%, flowers 63.56%, deer 82.73% of pixels removed. This confirms alpha creation, not perfect foreground segmentation. Inspection on a dark background found clipped white flower highlights, white retained inside the teacup handle, and gray shadow residue below the robot. The method is edge-connected light-background removal. Users need adjustable tolerance, original/edited comparison, undo and Smart Select/manual refinement in Studio. Never label this a flawless AI segmentation model. Evidence: `work/ai-builder/quality/cutout-test.json` and `cutout-contact-sheet.png`.

## Production reservation and API regression checks

The two-model pipeline reserves **250 Neurons per job** (50 for bounded prompt assistance, 200 for the image) before either model can run. The default application limit is **24 jobs / 6,000 Neurons per day**, with 2 jobs per visitor, 4 per daily network identifier, a cooldown and bounded concurrency. The allowance is deliberately smaller than the account's free ceiling. Real consumption remains recorded separately; reservations are not refunded after ambiguous failures.

Migration `0002_ai_model_costs.sql` adds per-operation model/cost/status records without content. Each model call requires a preceding ledger insert. Its absence disables generation safely. A timeout keeps the job uncertain and reserved until its lease ends and cannot start a later image call after a slow translation. Unknown upstream error values are replaced by fixed public error codes. Unexpected higher measured cost updates reservation accounting and opens the circuit.

Thirteen isolated API tests passed with mocked provider responses and real SQLite SQL execution. These tests verify contract/security behavior, not additional real inference: 10 simultaneous endpoint requests, origin/session/Turnstile rejection, 403/429/3040 capacity handling, 500/malformed JSON, executable metadata, unknown fields, invalid Unicode, truncated translation, timeout state, per-model accounting, unexpected costs and missing migrations. Log: `work/ai-builder/quality/api-security-tests.log`. The earlier real-image proof count remains unchanged.
