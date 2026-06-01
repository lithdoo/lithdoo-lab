#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DAY_LOOM_DIR:-}" ]]; then
  echo "[ERROR] ensure-day-loom.sh: DAY_LOOM_DIR is not set." >&2
  exit 1
fi

MODE="${1:-init}"
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
EXAMPLE_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
PROMPTPILE_DIST="$DAY_LOOM_DIR/node_modules/promptpile/dist/index.js"
DAY_LOOM_DIST="$DAY_LOOM_DIR/dist/index.js"
REPO_MCP_DIR="$DAY_LOOM_DIR/../../promptpile/promptpile-mcp"
REPO_MCP_DIST="$REPO_MCP_DIR/dist/src/index.js"
FILESYSTEM_MCP_DIST="$EXAMPLE_ROOT/.runtime/node_modules/@modelcontextprotocol/server-filesystem/dist/index.js"

if [[ ! -f "$PROMPTPILE_DIST" ]]; then
  echo "Installing dependencies in packages/day-loom..."
  (cd "$DAY_LOOM_DIR" && npm install)
fi

echo "Building day-loom..."
(cd "$DAY_LOOM_DIR" && npm run build)

if [[ ! -f "$PROMPTPILE_DIST" || ! -f "$DAY_LOOM_DIST" ]]; then
  echo "[ERROR] day-loom dependencies or dist are incomplete." >&2
  exit 1
fi

if [[ "$MODE" != "revise" ]]; then exit 0; fi

if [[ -z "${PROMPTPILE_MCP_BASE_URL:-}" && -z "${PROMPTPILE_MCP_BIN:-}" && ! -f "$REPO_MCP_DIST" ]] && ! command -v promptpile-mcp >/dev/null 2>&1; then
  if [[ -f "$REPO_MCP_DIR/package.json" ]]; then
    echo "Installing and building repository promptpile-mcp..."
    (cd "$REPO_MCP_DIR" && npm install && npm run build)
  fi
fi

if [[ -z "${PROMPTPILE_MCP_BASE_URL:-}" && -z "${PROMPTPILE_MCP_BIN:-}" && ! -f "$REPO_MCP_DIST" ]] && ! command -v promptpile-mcp >/dev/null 2>&1; then
  echo "[ERROR] promptpile-mcp CLI is required for interactive revise." >&2
  exit 1
fi

if [[ -z "${PROMPTPILE_MCP_BASE_URL:-}" && ! -f "$FILESYSTEM_MCP_DIST" ]]; then
  echo "Installing isolated filesystem MCP runtime..."
  npm install --prefix "$EXAMPLE_ROOT/.runtime" @modelcontextprotocol/server-filesystem@2026.1.14
fi

if [[ -z "${PROMPTPILE_MCP_BASE_URL:-}" && ! -f "$FILESYSTEM_MCP_DIST" ]]; then
  echo "[ERROR] filesystem MCP not found at: $FILESYSTEM_MCP_DIST" >&2
  exit 1
fi
