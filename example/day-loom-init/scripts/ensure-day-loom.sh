#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DAY_LOOM_DIR:-}" ]]; then
  echo "[ERROR] ensure-day-loom.sh: DAY_LOOM_DIR is not set." >&2
  exit 1
fi

PROMPTPILE_DIST="$DAY_LOOM_DIR/node_modules/promptpile/dist/index.js"
DAY_LOOM_DIST="$DAY_LOOM_DIR/dist/index.js"

if [[ ! -f "$PROMPTPILE_DIST" ]]; then
  echo "Installing dependencies in packages/day-loom..."
  (cd "$DAY_LOOM_DIR" && npm install)
fi

if [[ ! -f "$DAY_LOOM_DIST" ]]; then
  echo "Building day-loom..."
  (cd "$DAY_LOOM_DIR" && npm run build)
fi

if [[ ! -f "$PROMPTPILE_DIST" ]]; then
  echo "[ERROR] promptpile not found at:" >&2
  echo "  $PROMPTPILE_DIST" >&2
  echo "Run manually: cd packages/day-loom && npm install" >&2
  exit 1
fi

if [[ ! -f "$DAY_LOOM_DIST" ]]; then
  echo "[ERROR] day-loom dist not found at:" >&2
  echo "  $DAY_LOOM_DIST" >&2
  exit 1
fi
