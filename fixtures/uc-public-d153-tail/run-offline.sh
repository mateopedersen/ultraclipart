#!/usr/bin/env bash
set -euo pipefail
cd /work
mkdir -p /scratch/home /scratch/tmp /scratch/cache reports/private-tail
python3 /harness/verify-overlay.py /work /harness --verify-only
./node_modules/.bin/astro preview --host 127.0.0.1 --port 4321 --ignore-lock > reports/private-tail/preview.log 2>&1 &
preview_pid=$!
trap 'kill "$preview_pid" 2>/dev/null || true' EXIT
ready=0
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:4321/ > /dev/null; then ready=1; break; fi
  if ! kill -0 "$preview_pid" 2>/dev/null; then break; fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then cat reports/private-tail/preview.log; exit 1; fi
export BASE_URL=http://127.0.0.1:4321 UC_BASE_URL=http://127.0.0.1:4321 UC_BROWSER=chromium
overall=0
run_case() {
  local name="$1"; shift
  local code=0
  timeout --kill-after=10s 1800s "$@" > "reports/private-tail/round-$round-$name.log" 2>&1 || code=$?
  printf '%s\t%s\t%s\n' "$round" "$name" "$code" >> reports/private-tail/status.tsv
  printf 'PUBLIC_D153_TAIL round=%s case=%s exit=%s\n' "$round" "$name" "$code"
  if [ "$code" -ne 0 ]; then tail -n 35 "reports/private-tail/round-$round-$name.log"; overall=1; fi
}
for round in 1 2; do
  python3 /harness/verify-overlay.py /work /harness --verify-only
  run_case cache-policy node --test tests/index-cache-policy.mjs
  run_case cute-surprise node tests/e2e/cute-surprise.mjs
  run_case fruit-categories node tests/e2e/fruit-categories.mjs
  run_case animal-gallery env EVIDENCE_DIR="reports/tail-evidence/round-$round/animal" node tests/e2e/package-gallery.mjs
  run_case fruit-gallery env SOURCE_COLLECTION=owner-fruit-2026-10-24 EXPECTED_ARTWORKS=550 EXPECTED_TOPICS=11 EVIDENCE_DIR="reports/tail-evidence/round-$round/fruit" node tests/e2e/package-gallery.mjs
  run_case fruit-expansion env SOURCE_COLLECTION=owner-fruit-expansion-2026-10-24 EXPECTED_ARTWORKS=1450 EXPECTED_TOPICS=29 EVIDENCE_DIR="reports/tail-evidence/round-$round/expansion" node tests/e2e/package-gallery.mjs
  run_case fruit-five env SOURCE_COLLECTION=owner-fruit-five-packs-2026-10-24 EXPECTED_ARTWORKS=250 EXPECTED_TOPICS=5 EVIDENCE_DIR="reports/tail-evidence/round-$round/five" node tests/e2e/package-gallery.mjs
  run_case fire-leaf env SOURCE_COLLECTION=owner-fire-leaf-two-packs-2026-10-24 EXPECTED_ARTWORKS=100 EXPECTED_TOPICS=2 EVIDENCE_DIR="reports/tail-evidence/round-$round/fire" node tests/e2e/package-gallery.mjs
  run_case school env SOURCE_COLLECTION=owner-school-pack-2026-10-24 EXPECTED_ARTWORKS=50 EXPECTED_TOPICS=1 EVIDENCE_DIR="reports/tail-evidence/round-$round/school" node tests/e2e/package-gallery.mjs
  run_case basketball env SOURCE_COLLECTION=owner-basketball-pack-2026-10-24 EXPECTED_ARTWORKS=50 EXPECTED_TOPICS=1 EVIDENCE_DIR="reports/tail-evidence/round-$round/basketball" node tests/e2e/package-gallery.mjs
  run_case book env SOURCE_COLLECTION=owner-book-pack-2026-10-24 EXPECTED_ARTWORKS=50 EXPECTED_TOPICS=1 EVIDENCE_DIR="reports/tail-evidence/round-$round/book" node tests/e2e/package-gallery.mjs
  run_case creator-touch node tests/e2e/creator-touch.mjs
  run_case studio-input node tests/e2e/studio-input.mjs
  run_case studio-upload node tests/e2e/studio-upload.mjs
  run_case webkit-categories env UC_BROWSER=webkit node tests/e2e/categories.mjs
  run_case webkit-header env UC_BROWSER=webkit node tests/e2e/header.mjs
  run_case webkit-favorite-boards env UC_BROWSER=webkit node tests/e2e/favorite-boards.mjs
  run_case webkit-favorites-workspace env UC_BROWSER=webkit node tests/e2e/favorites-workspace.mjs
  run_case webkit-brand-accents env UC_BROWSER=webkit node tests/e2e/brand-accents.mjs
  run_case webkit-responsive-controls env UC_BROWSER=webkit node tests/e2e/responsive-controls.mjs
  run_case webkit-performance-regressions env UC_BROWSER=webkit node tests/e2e/performance-regressions.mjs
  run_case webkit-performance-layout env UC_BROWSER=webkit node tests/e2e/performance-layout.mjs
  run_case webkit-cookie-startup env UC_BROWSER=webkit node tests/e2e/cookie-startup.mjs
  run_case webkit-warm-editor-cache env UC_BROWSER=webkit node tests/e2e/warm-editor-cache.mjs
  run_case webkit-mobile-performance env UC_BROWSER=webkit node tests/e2e/mobile-performance.mjs
  python3 /harness/summarize.py "$round"
done
python3 /harness/verify-overlay.py /work /harness --verify-only
python3 /harness/verify-media.py after-tests
exit "$overall"
