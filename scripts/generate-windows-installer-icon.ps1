# Regenerates src/main/resources/tm-mission-control.ico.
# 16-48 px come from src/main/icons/desktop-N.png (simplified art from generate-small-icons.py, readable at
# desktop and Start menu sizes); 64 px and up are scaled from the full icon.png.
# Requires ImageMagick 7+ on PATH (`magick`).
# Each size is written as a PNG frame first so the transparent corners survive.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "src/main/resources/icon.png"
$small = Join-Path $root "src/main/icons"
$out = Join-Path $root "src/main/resources/tm-mission-control.ico"
$tmp = Join-Path $root "src/main/resources/tm-mission-control-new.ico"
if (-not (Test-Path $src)) { throw "Missing: $src" }
$magick = Get-Command magick -ErrorAction SilentlyContinue
if (-not $magick) { throw "ImageMagick 'magick' not found on PATH." }

$frames = @()
foreach ($size in 16, 32, 48, 64, 96, 128, 256) {
    $frame = Join-Path $env:TEMP "tm-mission-control-$size.png"
    $drawn = Join-Path $small "desktop-$size.png"
    if (Test-Path $drawn) {
        & $magick.Source $drawn -background none -alpha on "PNG32:$frame"
    } else {
        & $magick.Source $src -background none -alpha on -resize "${size}x${size}" "PNG32:$frame"
    }
    $frames += $frame
}
& $magick.Source @frames $tmp
Remove-Item $frames
Move-Item -Force $tmp $out
Write-Host "Wrote $out"
