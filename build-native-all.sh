#!/usr/bin/env bash
# DEPRECATED (v2.1.12+): Smiley.Native is no longer shipped in releases.
# This script is kept for local development only — do not use for publishing.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
NATIVE="$ROOT/Smiley.Native"
OUT_ROOT="$ROOT/dist-native"
mkdir -p "$OUT_ROOT"

RIDS=(win-x64 osx-arm64 osx-x64 linux-x64)

cd "$NATIVE"
echo "==> Restoring..."
dotnet restore

for RID in "${RIDS[@]}"; do
  OUT="$OUT_ROOT/$RID"
  echo "==> Publishing Smiley Native $VERSION ($RID)..."
  dotnet publish -c Release -r "$RID" --self-contained true \
    -p:PublishTrimmed=true \
    -p:PublishSingleFile=true \
    -p:EnableCompressionInSingleFile=true \
    -o "$OUT"

  ZIP="$OUT_ROOT/Smiley-Native-${VERSION}-${RID}.zip"
  echo "==> Zipping $ZIP"
  rm -f "$ZIP"
  (cd "$OUT" && zip -r -q "$ZIP" .)
  ls -lh "$ZIP"
done

echo ""
echo "All native builds: $OUT_ROOT/Smiley-Native-${VERSION}-*.zip"
