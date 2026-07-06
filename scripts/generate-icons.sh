#!/usr/bin/env bash
# Regenerate Smiley PNG/ICO assets from SVG masters (transparent background).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/build"
SRC_ASSETS="$ROOT/src/assets"
MAGICK="${MAGICK:-magick}"

gen() {
  local svg="$1" out="$2" size="$3"
  "$MAGICK" -background none "$svg" -resize "${size}x${size}" "$out"
  echo "  ✓ $(basename "$out") (${size}px)"
}

echo "Generating icons from SVG…"
mkdir -p "$BUILD/icons" "$SRC_ASSETS"

# Master app icon — transparent, padded for OS icon generators
gen "$BUILD/icon-transparent.svg" "$BUILD/icon.png" 1024
gen "$BUILD/icon-transparent.svg" "$BUILD/icon-transparent.png" 512
gen "$BUILD/icon-light.svg" "$BUILD/icon-light.png" 512
gen "$BUILD/icon-dark.svg" "$BUILD/icon-dark.png" 512

# Tray (Windows)
gen "$BUILD/icon-transparent.svg" "$BUILD/icon-tray-16.png" 16
gen "$BUILD/icon-transparent.svg" "$BUILD/icon-tray-32.png" 32

# PWA / favicon sizes
gen "$BUILD/icon-transparent.svg" "$BUILD/icon-64.png" 64
gen "$BUILD/icon-transparent.svg" "$BUILD/icon-192.png" 192
gen "$BUILD/icon-transparent.svg" "$BUILD/icon-512.png" 512

# In-app assets (theme-aware + transparent default)
gen "$BUILD/icon-transparent.svg" "$SRC_ASSETS/icon.png" 512
gen "$BUILD/icon-light.svg" "$SRC_ASSETS/icon-light.png" 512
gen "$BUILD/icon-dark.svg" "$SRC_ASSETS/icon-dark.png" 512
gen "$BUILD/icon-transparent.svg" "$SRC_ASSETS/icon-64.png" 64
gen "$BUILD/icon-transparent.svg" "$SRC_ASSETS/icon-512.png" 512

# Linux hicolor set
for size in 16 32 48 64 128 256 512; do
  gen "$BUILD/icon-transparent.svg" "$BUILD/icons/${size}x${size}.png" "$size"
done

# Windows .ico (multi-size)
"$MAGICK" "$BUILD/icon-transparent.svg" -background none \
  \( -clone 0 -resize 16x16 \) \
  \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) \
  \( -clone 0 -resize 64x64 \) \
  \( -clone 0 -resize 128x128 \) \
  \( -clone 0 -resize 256x256 \) \
  -delete 0 "$BUILD/icon.ico"
echo "  ✓ icon.ico"

echo "Done."
