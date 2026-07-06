#!/usr/bin/env bash
# Ad-hoc sign Smiley.app for unsigned local/CI distribution.
# Fixes "damaged and can't be opened" from partial signatures — not the
# unnotarized "Apple could not verify" dialog (needs notarization; see docs/NOTARIZATION.md).
set -euo pipefail

APP="${1:?Usage: sign-mac-app.sh /path/to/Smiley.app [entitlements.plist]}"
ENTITLEMENTS="${2:-}"

sign_args=(--force --sign - --options runtime)
if [[ -n "$ENTITLEMENTS" && -f "$ENTITLEMENTS" ]]; then
  sign_args+=(--entitlements "$ENTITLEMENTS")
fi

# Sign nested helpers and frameworks inside-out (avoid --deep when possible).
if [[ -d "$APP/Contents/Frameworks" ]]; then
  while IFS= read -r -d '' bin; do
    codesign "${sign_args[@]}" "$bin" 2>/dev/null || true
  done < <(find "$APP/Contents/Frameworks" -type f -perm +111 -print0 2>/dev/null || true)

  while IFS= read -r -d '' fw; do
    codesign "${sign_args[@]}" "$fw"
  done < <(find "$APP/Contents/Frameworks" -name '*.framework' -print0)

  while IFS= read -r -d '' helper; do
    codesign "${sign_args[@]}" "$helper"
  done < <(find "$APP/Contents/Frameworks" -name '*.app' -print0)
fi

codesign "${sign_args[@]}" "$APP"

echo "Signed: $APP"
codesign --verify --deep --strict "$APP"
