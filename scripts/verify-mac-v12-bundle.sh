#!/usr/bin/env bash
# Fail CI if the Tauri .app lacks a proper bundle-level ad-hoc signature.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$(find "$ROOT/Smiley.v12/src-tauri/target" -path '*/release/bundle/macos/*.app' 2>/dev/null | head -1)"

if [[ -z "$APP" ]]; then
  echo "::error::No macOS .app bundle found under Smiley.v12/src-tauri/target"
  exit 1
fi

echo "Verifying signature: $APP"
codesign --verify --deep --strict --verbose=2 "$APP"
codesign -dv "$APP" 2>&1 | grep -E 'Signature=|Sealed Resources=' || true
echo "macOS bundle signature OK"
