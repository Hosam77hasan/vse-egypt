# generate-icons.ps1 — Generate kliopatra.ico and code.ico from kliopatra.png
#
# Run this once before building the installer. It converts the PNG icon
# (from vse-landing/public/assets/kliopatra.png) into .ico format that
# Inno Setup can use for the installer itself and the desktop shortcut.
#
# Requires: ImageMagick (`magick` command) or .NET System.Drawing
#
# Usage: .\scripts\generate-icons.ps1

$ErrorActionPreference = "Stop"

$pngSource = "$PSScriptRoot\..\vse-landing\public\assets\kliopatra.png"
$icoDest   = "$PSScriptRoot\..\resources\win32\kliopatra.ico"
$codeIco   = "$PSScriptRoot\..\resources\win32\code.ico"

if (-not (Test-Path $pngSource)) {
    Write-Error "kliopatra.png not found at $pngSource"
    exit 1
}

$outDir = "$PSScriptRoot\..\resources\win32"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

Write-Host "Generating .ico files from $pngSource..."

# Try ImageMagick first (most reliable)
$magick = Get-Command magick -ErrorAction SilentlyContinue
if ($magick) {
    & magick convert "$pngSource" -resize 256x256 "$icoDest"
    Copy-Item "$icoDest" "$codeIco" -Force
    Write-Host "✓ kliopatra.ico and code.ico generated via ImageMagick" -ForegroundColor Green
    Write-Host "  $icoDest" -ForegroundColor Green
    exit 0
}

# Fallback to .NET (Windows only, limited ICO support)
Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue
if ($? -ne $false) {
    $bitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path $pngSource))
    $icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
    $fs = [System.IO.File]::OpenWrite($icoDest)
    $icon.Save($fs)
    $fs.Close()
    $icon.Dispose()
    $bitmap.Dispose()
    Copy-Item "$icoDest" "$codeIco" -Force
    Write-Host "✓ kliopatra.ico and code.ico generated via .NET" -ForegroundColor Green
    exit 0
}

# No tool available — just copy the PNG (Inno Setup 6 can use PNG as icon in many cases)
Write-Warning "Neither ImageMagick nor .NET System.Drawing available."
Write-Warning "Copying PNG as fallback — Inno Setup 6 accepts .png for most icon fields."
Copy-Item $pngSource $icoDest -Force
Copy-Item "$icoDest" "$codeIco" -Force
Write-Host "⚠ kliopatra.png copied as .ico (PNG fallback)" -ForegroundColor Yellow
