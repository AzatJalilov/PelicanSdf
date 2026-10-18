#!/usr/bin/env bash
# Sequential one-shot benchmark sweep via the bare Claude Code CLI.
set -u
cd "$(dirname "$0")/.."
mkdir -p data/raw

LOG=data/raw/claude-sweep.log
RUNS=()
for model in claude-haiku-5-5 claude-sonnet-5-5 claude-opus-5-5 claude-fable-5-1; do
  for effort in low medium high xhigh max; do
    RUNS+=("$model $effort $model-$effort-run-01")
  done
done

for entry in "${RUNS[@]}"; do
  set -- $entry
  model="$1"; effort="$2"; id="$3"
  echo "=== $(date -Iseconds) START $id ($model / $effort) ===" | tee -a "$LOG"
  if [ -d "data/raw/$id" ]; then
    echo "SKIP $id: raw dir already exists" | tee -a "$LOG"
    continue
  fi
  node scripts/run-model-eval-claude.mjs --id "$id" --model "$model" --effort "$effort" >>"$LOG" 2>&1
  status=$?
  echo "=== $(date -Iseconds) END   $id exit=$status ===" | tee -a "$LOG"
done
echo "=== $(date -Iseconds) SWEEP COMPLETE ===" | tee -a "$LOG"
