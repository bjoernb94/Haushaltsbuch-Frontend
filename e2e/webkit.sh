#!/usr/bin/env bash
# E2E-Tests in WebKit (Desktop Safari, Mobile Safari) im offiziellen Playwright-Image, denn Playwright
# unterstützt WebKit nur unter Ubuntu und Debian. Argumente gehen an Playwright, z. B. --project=webkit.
# Läuft der Dev-Server auf :4200, nutzen die Tests ihn (Netz des Hosts), sonst starten sie ihn im Container.
set -euo pipefail

ORDNER=$(cd "$(dirname "$0")/.." && pwd)
# Muss genau zu Playwright im Lockfile passen, sonst fehlen dem Image die Browser (wie in der CI).
VERSION=$(node -p "require('$ORDNER/package-lock.json').packages['node_modules/playwright-core'].version")
PROJEKTE=(--project=webkit --project=mobile-safari)
for argument in "$@"; do
  [[ "$argument" == --project* ]] && PROJEKTE=()
done

exec podman run --rm --init --network host --security-opt label=disable --ipc host \
  -v "$ORDNER:/w" -w /w -e E2E_WEBKIT=1 -e HOME=/root \
  "mcr.microsoft.com/playwright:v$VERSION-noble" npx playwright test "${PROJEKTE[@]}" "$@"
