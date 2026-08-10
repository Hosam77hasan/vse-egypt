# generate-icons.ps1 — Generate kliopatra.ico and code.ico from kliopatra.png
#
# Run this once before building the installer. It converts the PNG icon
# (from vse-landing/public/assets/kliopatra.png) into .ico format that
# Inno Setup can use for the installer itself and the desktop shortcut.
#
# The script handles non-square images by padding them with transparent background.
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

# Try ImageMagick first (most reliable — handles transparency and non-square images)
$magick = Get-Command magick -ErrorAction SilentlyContinue
if ($magick) {
    Write-Host "Using ImageMagick for icon generation..."
    
    # Create a temporary square image with transparent background
    $tempSquare = Join-Path $env:TEMP "kliopatra_square.png"
    
    # Get image dimensions
    $identify = & magick identify "$pngSource" 2>&1
    Write-Host "Original image: $identify"
    
    # Pad to square with transparent background, then resize to 256x256
    & magick convert "$pngSource" `
        -background none `
        -gravity center `
        -extent 264x264 `
        -resize 256x256 `
        "$tempSquare"
    
    # Generate multi-resolution .ico file (16, 32, 48, 64, 128, 256)
    & magick convert "$tempSquare" `
        \( -clone 0 -resize 16x16 \) `
        \( -clone 0 -resize 32x32 \) `
        \( -clone 0 -resize 48x48 \) `
        \( -clone 0 -resize 64x64 \) `
        \( -clone 0 -resize 128x128 \) `
        \( -clone 0 -resize 256x256 \) `
        -delete 0 `
        "$icoDest"
    
    # Copy to code.ico as well
    Copy-Item "$icoDest" "$codeIco" -Force
    
    # Clean up
    Remove-Item "$tempSquare" -Force -ErrorAction SilentlyContinue
    
    Write-Host "✓ kliopatra.ico and code.ico generated via ImageMagick" -ForegroundColor Green
    Write-Host "  $icoDest" -ForegroundColor Green
    Write-Host "  Multi-resolution: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256" -ForegroundColor Green
    exit 0
}

# Fallback to .NET (Windows only, limited ICO support)
Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue
if ($? -ne $false) {
    Write-Host "Using .NET System.Drawing for icon generation..."
    
    $bitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path $pngSource))
    
    # Create a square bitmap with transparent background
    $size = [Math]::Max($bitmap.Width, $bitmap.Height)
    $squareBitmap = New-Object System.Drawing.Bitmap($size, $size)
    $squareBitmap.MakeTransparent()
    
    $graphics = [System.Drawing.Graphics]::FromImage($squareBitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    # Draw centered
    $x = ($size - $bitmap.Width) / 2
    $y = ($size - $bitmap.Height) / 2
    $graphics.DrawImage($bitmap, $x, $y, $bitmap.Width, $bitmap.Height)
    
    $icon = [System.Drawing.Icon]::FromHandle($squareBitmap.GetHicon())
    $fs = [System.IO.File]::OpenWrite($icoDest)
    $icon.Save($fs)
    $fs.Close()
    $icon.Dispose()
    $squareBitmap.Dispose()
    $graphics.Dispose()
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
