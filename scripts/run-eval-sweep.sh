#!/usr/bin/env bash
# Sequential one-shot benchmark sweep via the pi SDK (OpenRouter).
# Each run is a fresh in-memory agent session with no tools.
set -u
cd "$(dirname "$0")/.."
mkdir -p data/raw

LOG=data/raw/sweep.log
RUNS=(
  "z-ai/glm-5.2 low glm-5-2-low-run-01"
  "z-ai/glm-5.2 high glm-5-2-high-run-01"
  "moonshotai/kimi-k3 low kimi-k3-low-run-01"
  "moonshotai/kimi-k3 high kimi-k3-high-run-01"
  "deepseek/deepseek-v4-pro low deepseek-v4-pro-low-run-01"
  "deepseek/deepseek-v4-pro high deepseek-v4-pro-high-run-01"
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
    --id "$id" --model "$model" --effort "$effort" --max-tokens 65536 \
    >>"$LOG" 2>&1
  status=$?
  echo "=== $(date -Iseconds) END   $id exit=$status ===" | tee -a "$LOG"
done
echo "=== $(date -Iseconds) SWEEP COMPLETE ===" | tee -a "$LOG"
