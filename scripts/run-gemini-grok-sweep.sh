#!/usr/bin/env bash
# Sequential one-shot benchmark sweep via the pi SDK (OpenRouter) for
# Gemini Pro/Flash and Grok (latest), low + high reasoning effort each.
set -u
cd "$(dirname "$0")/.."
mkdir -p data/raw

LOG=data/raw/gemini-grok-sweep.log
RUNS=(
  "google/gemini-3.1-pro-preview low gemini-3-1-pro-low-run-01"
  "google/gemini-3.1-pro-preview high gemini-3-1-pro-high-run-01"
  "google/gemini-3.5-flash low gemini-3-5-flash-low-run-01"
  "google/gemini-3.5-flash high gemini-3-5-flash-high-run-01"
  "x-ai/grok-4.5 low grok-4-5-low-run-01"
  "x-ai/grok-4.5 high grok-4-5-high-run-01"
)

for entry in "${RUNS[@]}"; do
  set -- $entry
  model="$1"; effort="$2"; id="$3"
  echo "=== $(date -Iseconds) START $id ($model / $effort) ===" | tee -a "$LOG"
  if [ -d "data/raw/$id" ]; then
    echo "SKIP $id: raw dir already exists" | tee -a "$LOG"
    continue
  fi
  node --max-old-space-size=6144 scripts/run-model-eval-pi.mjs \
    --id "$id" --model "$model" --effort "$effort" --max-tokens 131072 \
    >>"$LOG" 2>&1
  status=$?
  echo "=== $(date -Iseconds) END   $id exit=$status ===" | tee -a "$LOG"
done
echo "=== $(date -Iseconds) SWEEP COMPLETE ===" | tee -a "$LOG"
