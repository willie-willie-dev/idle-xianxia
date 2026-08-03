#!/usr/bin/env bash
set -euo pipefail
OUT=/home/lovecactus/.openclaw/workspace/tmp-qa
mkdir -p "$OUT"
cd "$OUT"
if ! npx playwright install chromium; then
  echo "playwright install failed" >&2
  exit 1
fi
node /home/lovecactus/projects/idle-xianxia/tmp-qa-capture.mjs
ls -la "$OUT/sui-export-direct.png" "$OUT/sui-export-direct.md" "$OUT/capture-meta.json"
