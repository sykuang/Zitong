#!/bin/bash
set -e

cd /Users/kenkuang/src/Zitong/src-tauri/icons
SVG="icon-master.svg"

render() {
  local size=$1 out=$2
  rsvg-convert -w "$size" -h "$size" "$SVG" | magick png:- -type TrueColorAlpha -depth 8 -define png:color-type=6 "$out"
}

# Main icon PNGs
render 1024 icon.png
render 32 32x32.png
render 128 128x128.png
render 256 "128x128@2x.png"

# Windows Square logos
render 30 Square30x30Logo.png
render 44 Square44x44Logo.png
render 71 Square71x71Logo.png
render 89 Square89x89Logo.png
render 107 Square107x107Logo.png
render 142 Square142x142Logo.png
render 150 Square150x150Logo.png
render 284 Square284x284Logo.png
render 310 Square310x310Logo.png
render 50 StoreLogo.png

# macOS .icns
mkdir -p icon.iconset
render 16 icon.iconset/icon_16x16.png
render 32 "icon.iconset/icon_16x16@2x.png"
render 32 icon.iconset/icon_32x32.png
render 64 "icon.iconset/icon_32x32@2x.png"
render 128 icon.iconset/icon_128x128.png
render 256 "icon.iconset/icon_128x128@2x.png"
render 256 icon.iconset/icon_256x256.png
render 512 "icon.iconset/icon_256x256@2x.png"
render 512 icon.iconset/icon_512x512.png
render 1024 "icon.iconset/icon_512x512@2x.png"
iconutil -c icns icon.iconset -o icon.icns
rm -rf icon.iconset

# Windows .ico
magick icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# Tray icon (monochrome, 44x44 @2x for Retina)
rsvg-convert -w 44 -h 44 tray-icon.svg | magick png:- -type TrueColorAlpha -depth 8 -define png:color-type=6 tray-icon.png

echo "All icons regenerated successfully!"
file icon.png 32x32.png
