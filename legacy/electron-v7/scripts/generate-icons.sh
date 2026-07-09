#!/usr/bin/env bash
# Regenerate Smiley PNG/ICO assets from SVG masters or logo-master.png.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/build"
SRC_ASSETS="$ROOT/src/assets"
MAGICK="${MAGICK:-magick}"
MASTER_PNG="$BUILD/logo-master.png"

gen() {
  local svg="$1" out="$2" size="$3"
  "$MAGICK" -background none "$svg" -resize "${size}x${size}" "$out"
  echo "  ✓ $(basename "$out") (${size}px)"
}

gen_png() {
  local src="$1" out="$2" size="$3"
  "$MAGICK" "$src" -background none -resize "${size}x${size}" "$out"
  echo "  ✓ $(basename "$out") (${size}px)"
}

mkdir -p "$BUILD/icons" "$SRC_ASSETS"

if [[ -f "$MASTER_PNG" ]]; then
  echo "Generating icons from logo-master.png…"
  SHAPE="/tmp/smiley-shape-$$.png"
  "$MAGICK" "$MASTER_PNG" -fuzz 12% -transparent white -trim +repage \
    -background none -gravity center -extent 512x512 "$SHAPE"
  "$MAGICK" "$SHAPE" -channel RGB -fill black -colorize 100% "$BUILD/icon-dark-raster.png"
  "$MAGICK" "$SHAPE" -channel RGB -fill white -colorize 100% "$BUILD/icon-light-raster.png"
  rm -f "$SHAPE"
  gen_png "$BUILD/icon-dark-raster.png" "$BUILD/icon.png" 1024
  gen_png "$BUILD/icon-dark-raster.png" "$BUILD/icon-transparent.png" 512
  gen_png "$BUILD/icon-light-raster.png" "$BUILD/icon-light.png" 512
  gen_png "$BUILD/icon-dark-raster.png" "$BUILD/icon-dark.png" 512
  gen_png "$BUILD/icon-dark-raster.png" "$BUILD/icon-tray-16.png" 16
  gen_png "$BUILD/icon-dark-raster.png" "$BUILD/icon-tray-32.png" 32
  gen_png "$BUILD/icon-dark-raster.png" "$BUILD/icon-64.png" 64
  gen_png "$BUILD/icon-dark-raster.png" "$BUILD/icon-192.png" 192
  gen_png "$BUILD/icon-dark-raster.png" "$BUILD/icon-512.png" 512
else
  echo "Generating icons from SVG…"
  gen "$BUILD/icon-transparent.svg" "$BUILD/icon.png" 1024
  gen "$BUILD/icon-transparent.svg" "$BUILD/icon-transparent.png" 512
  gen "$BUILD/icon-light.svg" "$BUILD/icon-light.png" 512
  gen "$BUILD/icon-dark.svg" "$BUILD/icon-dark.png" 512
  gen "$BUILD/icon-transparent.svg" "$BUILD/icon-tray-16.png" 16
  gen "$BUILD/icon-transparent.svg" "$BUILD/icon-tray-32.png" 32
  gen "$BUILD/icon-transparent.svg" "$BUILD/icon-64.png" 64
  gen "$BUILD/icon-transparent.svg" "$BUILD/icon-192.png" 192
  gen "$BUILD/icon-transparent.svg" "$BUILD/icon-512.png" 512
fi

# In-app assets (theme-aware + transparent default)
gen_png "$BUILD/icon-transparent.png" "$SRC_ASSETS/icon.png" 512
gen_png "$BUILD/icon-light.png" "$SRC_ASSETS/icon-light.png" 512
gen_png "$BUILD/icon-dark.png" "$SRC_ASSETS/icon-dark.png" 512
gen_png "$BUILD/icon-transparent.png" "$SRC_ASSETS/icon-64.png" 64
gen_png "$BUILD/icon-transparent.png" "$SRC_ASSETS/icon-512.png" 512

# Linux hicolor set
for size in 16 32 48 64 128 256 512; do
  gen_png "$BUILD/icon-transparent.png" "$BUILD/icons/${size}x${size}.png" "$size"
done

# Windows .ico (multi-size)
"$MAGICK" "$BUILD/icon-transparent.png" -background none \
  \( -clone 0 -resize 16x16 \) \
  \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) \
  \( -clone 0 -resize 64x64 \) \
  \( -clone 0 -resize 128x128 \) \
  \( -clone 0 -resize 256x256 \) \
  -delete 0 "$BUILD/icon.ico"
echo "  ✓ icon.ico"

echo "Done."
