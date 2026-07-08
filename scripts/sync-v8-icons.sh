#!/usr/bin/env bash
# Copy canonical Smiley icons from build/ into Smiley.v8 (Tauri bundle + UI assets).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/build"
V8_ICONS="$ROOT/Smiley.v8/src-tauri/icons"
V8_ASSETS="$ROOT/Smiley.v8/src/assets"
MAGICK="${MAGICK:-magick}"
MASTER_RGBA="$(mktemp /tmp/smiley-rgba-XXXXXX.png)"

mkdir -p "$V8_ICONS" "$V8_ASSETS"

echo "Syncing Smiley v8 icons from build/…"

# Tauri requires RGBA PNGs (srgba 4-channel) — resize from a TrueColor master.
"$MAGICK" "$BUILD/logo-master.png" -fuzz 12% -transparent white -trim +repage \
  -background none -gravity center -extent 512x512 \
  -channel RGB -fill '#000000' -colorize 100 -alpha on PNG32:"$MASTER_RGBA"

resize_rgba() {
  local out="$1" size="$2"
  "$MAGICK" "$MASTER_RGBA" -filter Lanczos -resize "${size}x${size}" -type TrueColorAlpha PNG32:"$out"
}

cp "$BUILD/icon.png" "$V8_ICONS/icon.png"
cp "$BUILD/icon.png" "$V8_ICONS/icon-src.png"
cp "$BUILD/icon.ico" "$V8_ICONS/icon.ico"
resize_rgba "$V8_ICONS/32x32.png" 32
resize_rgba "$V8_ICONS/128x128.png" 128
resize_rgba "$V8_ICONS/128x128@2x.png" 256
cp "$BUILD/icon-tray-16.png" "$V8_ASSETS/icon-tray-16.png"
cp "$BUILD/icon-tray-32.png" "$V8_ASSETS/icon-tray-32.png"
cp "$BUILD/icon-transparent.png" "$V8_ASSETS/icon.png"
cp "$BUILD/icon-light.png" "$V8_ASSETS/icon-light.png"
cp "$BUILD/icon-dark.png" "$V8_ASSETS/icon-dark.png"

# Windows store / square logos from master transparent icon
for size in 30 44 71 89 107 142 150 284 310; do
  resize_rgba "$V8_ICONS/Square${size}x${size}Logo.png" "$size"
done
resize_rgba "$V8_ICONS/StoreLogo.png" 50

# macOS .icns
ICONSET="$(mktemp -d)/Smiley.iconset"
mkdir -p "$ICONSET"
gen_icon() {
  local name="$1" size="$2"
  resize_rgba "$ICONSET/${name}.png" "$size"
}
gen_icon icon_16x16 16
gen_icon icon_16x16@2x 32
gen_icon icon_32x32 32
gen_icon icon_32x32@2x 64
gen_icon icon_128x128 128
gen_icon icon_128x128@2x 256
gen_icon icon_256x256 256
gen_icon icon_256x256@2x 512
gen_icon icon_512x512 512
gen_icon icon_512x512@2x 1024
iconutil -c icns "$ICONSET" -o "$V8_ICONS/icon.icns"
rm -rf "$(dirname "$ICONSET")"
rm -f "$MASTER_RGBA"

echo "✓ Smiley v8 icons synced ($(md5 -q "$V8_ICONS/icon.png"))"
