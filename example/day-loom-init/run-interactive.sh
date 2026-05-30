#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR"

if [[ -f ".env" ]]; then
  while IFS='=' read -r key value; do
    [[ -z "${key// }" || "${key:0:1}" == "#" ]] && continue
    if [[ "$key" == "DEEPSEEK_API_KEY" && -n "${value:-}" ]]; then
      export DEEPSEEK_API_KEY="$value"
    fi
  done < ".env"
fi

if [[ -z "${DEEPSEEK_API_KEY:-}" ]]; then
  echo "[ERROR] DEEPSEEK_API_KEY is not set." >&2
  echo "Set DEEPSEEK_API_KEY in your environment, OR create .env in this folder with:" >&2
  echo "  DEEPSEEK_API_KEY=sk-..." >&2
  echo "If you updated a shell profile, open a new shell or run: source ~/.bashrc" >&2
  exit 1
fi

OUT_DIR="$SCRIPT_DIR/output/world-interactive"
export DAY_LOOM_DIR="$SCRIPT_DIR/../../packages/day-loom"

"$SCRIPT_DIR/scripts/ensure-day-loom.sh"

if [[ -d "$OUT_DIR" ]]; then
  echo "Removing previous output: $OUT_DIR"
  rm -rf "$OUT_DIR"
fi

echo "Running day-loom init (interactive)..."
echo "Finish each reply with Ctrl+D on an empty line."
npx --prefix "$DAY_LOOM_DIR" day-loom init \
  -d "$OUT_DIR" \
  --id campus_life \
  --title "校园日常" \
  --max-rounds 8 \
  --keep-session

echo "Verifying world save..."
node "$SCRIPT_DIR/scripts/verify-world.js" "$OUT_DIR" --mode interactive

echo
echo "Success: $OUT_DIR"
