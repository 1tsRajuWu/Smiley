#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/Smiley.Native"

echo "==> Restoring..."
dotnet restore

echo "==> Building (Debug)..."
dotnet build -c Release

RID="${1:-}"
if [ -z "$RID" ]; then
  case "$(uname -s)" in
    Darwin)
      ARCH="$(uname -m)"
      [ "$ARCH" = "arm64" ] && RID="osx-arm64" || RID="osx-x64"
      ;;
    Linux) RID="linux-x64" ;;
    *) RID="win-x64" ;;
  esac
fi

OUT="../dist-native/$RID"
echo "==> Publishing $RID (trimmed, single-file)..."
dotnet publish -c Release -r "$RID" --self-contained true \
  -p:PublishTrimmed=true \
  -p:PublishSingleFile=true \
  -p:EnableCompressionInSingleFile=true \
  -o "$OUT"

echo ""
echo "Done! Output: $OUT"
du -sh "$OUT"/* 2>/dev/null | head -5

if [[ "$RID" == osx-* ]] && command -v create-dmg &>/dev/null; then
  echo "==> Creating DMG..."
  create-dmg --volname "Smiley" --window-size 600 400 \
    "../dist-native/Smiley-${RID}.dmg" "$OUT/Smiley" 2>/dev/null || true
fi
