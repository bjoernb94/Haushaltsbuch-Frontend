#!/usr/bin/env bash
# Startet das gebaute Image (npm run image) mit einer Backend-Attrappe im selben Pod und prüft es.
# Argumente gehen an Playwright, z. B. --project=chromium.
set -euo pipefail

POD=haushaltsbuch-image-test
ORDNER=$(cd "$(dirname "$0")" && pwd)

aufraeumen() {
  podman pod rm -f "$POD" >/dev/null 2>&1 || true
}
trap aufraeumen EXIT
aufraeumen

podman pod create --name "$POD" -p 127.0.0.1:18080:8080 >/dev/null
podman run -d --pod "$POD" --name "$POD-backend" \
  -v "$ORDNER/backend-attrappe.mjs:/attrappe.mjs:ro,Z" \
  docker.io/library/node:26-alpine node /attrappe.mjs >/dev/null
podman run -d --pod "$POD" --name "$POD-app" \
  -e BACKEND_URL=http://127.0.0.1:9000 \
  localhost/haushaltsbuch-frontend:latest >/dev/null

for _ in $(seq 1 30); do
  curl -fsS -o /dev/null http://127.0.0.1:18080/ && break
  sleep 1
done

if ! npx playwright test -c playwright.image.config.ts "$@"; then
  podman logs "$POD-app" | tail -n 30
  exit 1
fi
