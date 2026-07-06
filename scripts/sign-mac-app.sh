#!/usr/bin/env bash
# Ad-hoc sign Smiley.app for unsigned local/CI distribution.
# Re-signs the entire bundle with one identity so macOS 15+ does not reject
# Electron Framework with "different Team IDs" (DYLD crash on launch).
# Consistent deep signing also gives Squirrel ShipIt the best chance to accept
# in-app updates (still unreliable without a Developer ID — see README).
set -euo pipefail

APP="${1:?Usage: sign-mac-app.sh /path/to/Smiley.app [entitlements.plist]}"
ENTITLEMENTS="${2:-}"

sign_args=(--force --sign - --options runtime)
ent_args=()
if [[ -n "$ENTITLEMENTS" && -f "$ENTITLEMENTS" ]]; then
  ent_args=(--entitlements "$ENTITLEMENTS")
fi

is_macho() {
  file "$1" 2>/dev/null | grep -q 'Mach-O'
}

sign_file() {
  local target="$1"
  local use_ent="${2:-0}"
  if [[ "$use_ent" == "1" ]]; then
    codesign "${sign_args[@]}" "${ent_args[@]}" "$target"
  else
    codesign "${sign_args[@]}" "$target"
  fi
}

# Squirrel ShipIt helper (used during in-app updates)
SHIPIT="$APP/Contents/Frameworks/Squirrel.framework/Versions/A/Resources/ShipIt"
if [[ -f "$SHIPIT" ]]; then
  sign_file "$SHIPIT" 0
fi

# Sign nested Mach-O binaries inside-out (deepest paths first).
if [[ -d "$APP/Contents" ]]; then
  while IFS= read -r -d '' bin; do
    is_macho "$bin" || continue
    # Main executable and .app helpers get entitlements; dylibs/frameworks do not.
    if [[ "$bin" == *"/MacOS/"* ]] || [[ "$bin" == *.app/* ]]; then
      sign_file "$bin" 1 2>/dev/null || sign_file "$bin" 0
    else
      sign_file "$bin" 0 2>/dev/null || true
    fi
  done < <(find "$APP/Contents" -type f -print0 2>/dev/null | sort -rz)

  while IFS= read -r -d '' bundle; do
    sign_file "$bundle" 1
  done < <(find "$APP/Contents" \( -name '*.app' -o -name '*.framework' -o -name '*.xpc' \) -print0 2>/dev/null | sort -rz)
fi

sign_file "$APP" 1

echo "Signed: $APP"
codesign --verify --deep --strict "$APP"
