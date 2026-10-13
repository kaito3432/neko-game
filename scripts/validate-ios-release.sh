#!/bin/sh
set -eu
[ "${CONFIGURATION:-Debug}" = Release ] || exit 0
task_root="${SRCROOT}/../.."
assets="${SRCROOT}/App/public"
config="$assets/ad-config.js"
if ! /usr/bin/grep -q '"testing":false' "$config" || /usr/bin/grep -q '3940256099942544' "$config"; then
  echo 'error: Release requires prepared production rewarded ads configuration (scripts/prepare-web-assets.cjs --release).'
  exit 1
fi
if [ -z "${NYAN_ADMOB_APP_ID:-}" ] || echo "$NYAN_ADMOB_APP_ID" | /usr/bin/grep -q '3940256099942544'; then
  echo 'error: Set NYAN_ADMOB_APP_ID to the real iOS AdMob App ID.'
  exit 1
fi
/usr/bin/grep -q "https://nyan-chase-online.honda19990602.workers.dev" "$assets/api-environment.js" || exit 1
node_binary="${NYAN_NODE_BINARY:-$(command -v node || true)}"
[ -n "$node_binary" ] || { echo 'error: Set NYAN_NODE_BINARY for the Release source-integrity check.'; exit 1; }
"$node_binary" "$task_root/scripts/validate-generated-web.cjs" "$assets"
for source in "$task_root"/*.js "$task_root"/*.css; do
  case "$source" in */ad-config.js|*/api-environment.sandbox.js) continue;; esac
  /usr/bin/cmp -s "$source" "$assets/$(basename "$source")" || { echo "error: stale Web asset $(basename "$source"); sync iOS again."; exit 1; }
done
