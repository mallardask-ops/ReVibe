#!/usr/bin/env bash
# Renders the ReVibe icons from the SVGs made by make_logo.py.
# Needs rsvg-convert and ImageMagick.
set -eu
cd "$(dirname "$0")"
python3 make_logo.py
mkdir -p png
for s in 16 24 32 48 64 128 256 512 1024; do
  rsvg-convert -w "$s" -h "$s" revibe.svg -o "png/${s}x${s}.png"
done
magick png/16x16.png png/24x24.png png/32x32.png png/48x48.png png/64x64.png png/128x128.png png/256x256.png revibe.ico
rsvg-convert -w 32 -h 32 revibe-tray.svg -o revibe-tray.png
# the Electron shell and the web app load these
cp png/512x512.png ../../shell/electron/revibe-icon.png
cp revibe-tray.png ../../shell/electron/revibe-tray.png
cp revibe-glyph.svg ../../frontend/public/favicon.svg
echo "icons ready"
