#!/usr/bin/env bash
# Ad-hoc sign Smiley.app for unsigned local/CI distribution.
# Re-signs the entire bundle with one identity so macOS 15+ does not reject
# Electron Framework with "different Team IDs" (DYLD crash on launch).
set -euo pipefail

APP="${1:?Usage: sign-mac-app.sh /path/to/Smiley.app [entitlements.plist]}"
ENTITLEMENTS="${2:-}"

sign_args=(--force --sign - --options runtime)
ent_args=()
if [[ -n "$ENTITLEMENTS" && -f "$ENTITLEMENTS" ]]; then
  ent_args=(--entitlements "$ENTITLEMENTS")
fi

# Sign nested Mach-O binaries inside-out (dylibs and helpers before frameworks).
if [[ -d "$APP/Contents/Frameworks" ]]; then
  while IFS= read -r -d '' bin; do
    if file "$bin" 2>/dev/null | grep -q 'Mach-O'; then
      codesign "${sign_args[@]}" "$bin" 2>/dev/null || true
    fi
  done < <(find "$APP/Contents/Frameworks" -type f \( -name '*.dylib' -o -name '*.so' -o -perm +111 \) -print0 2>/dev/null | sort -rz)

  while IFS= read -r -d '' helper; do
    codesign "${sign_args[@]}" "${ent_args[@]}" "$helper"
  done < <(find "$APP/Contents/Frameworks" -name '*.app' -print0 2>/dev/null | sort -rz)

  while IFS= read -r -d '' fw; do
    codesign "${sign_args[@]}" "$fw"
  done < <(find "$APP/Contents/Frameworks" -name '*.framework' -print0 2>/dev/null | sort -rz)
fi

if [[ -d "$APP/Contents/MacOS" ]]; then
  for bin in "$APP/Contents/MacOS/"*; do
    [[ -f "$bin" ]] || continue
    codesign "${sign_args[@]}" "${ent_args[@]}" "$bin"
  done
fi

codesign "${sign_args[@]}" "${ent_args[@]}" "$APP"

echo "Signed: $APP"
codesign --verify --deep --strict "$APP"
