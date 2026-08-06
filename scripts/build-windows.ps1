# build-windows.ps1 — VS Code Egypt Windows packaging
#
# Run from the vscode-egypt/vscode directory (the actual VS Code source checkout,
# with all patches/user/*.patch already applied — see the main README).
#
# ============================== NOT RUN IN THIS SESSION ==============================
# This script was written and reviewed for correctness against VSCodium's real build
# scripts and gulpfile task names, but was NOT executed — this sandbox has no Windows
# environment, no Inno Setup installation, and no code-signing certificate. Run this
# on an actual Windows machine (or Windows CI runner) with the prerequisites below.
# ==========================================================================================

$ErrorActionPreference = "Stop"

Write-Host "== VS Code Egypt — Windows build ==" -ForegroundColor Green

# --- Prerequisites check ---
$required = @("node", "yarn", "python")
foreach ($cmd in $required) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Error "$cmd not found on PATH. See the environment setup section of the main README."
        exit 1
    }
}

# --- Step 1: compile TypeScript -> JS ---
Write-Host "-- Compiling..." -ForegroundColor Cyan
yarn gulp compile-build

# --- Step 2: produce the win32-x64 unpacked app (Electron + JS bundled) ---
# This is the real VSCodium/VS Code gulp task name for this target — not a generic
# electron-builder invocation, since this fork's build pipeline is VSCodium's own
# gulpfile, established in the environment-setup step of this project.
Write-Host "-- Packaging win32-x64..." -ForegroundColor Cyan
yarn gulp vscode-win32-x64-min

# The above produces an unpacked app tree, typically at:
#   ..\VSCode-win32-x64\
# Verify that path before continuing — gulp task output paths can shift between
# VS Code source versions, confirm against your checked-out version's gulpfile.vscode.js.

$unpackedPath = "..\VSCode-win32-x64"
if (-not (Test-Path $unpackedPath)) {
    Write-Error "Expected unpacked app at $unpackedPath but it doesn't exist. Check the gulp task output above for the actual path."
    exit 1
}

# --- Step 3: code signing (REQUIRES A REAL CERTIFICATE — not present in this repo) ---
# Windows SmartScreen will flag the installer as "Unknown Publisher" without this.
# You need an EV or standard Authenticode code-signing certificate from a CA
# (DigiCert, Sectigo, etc.) — this cannot be generated or substituted.
if ($env:CODE_SIGN_CERT_PATH -and $env:CODE_SIGN_CERT_PASSWORD) {
    Write-Host "-- Signing binaries..." -ForegroundColor Cyan
    & signtool sign /f $env:CODE_SIGN_CERT_PATH /p $env:CODE_SIGN_CERT_PASSWORD /tr http://timestamp.digicert.com /td sha256 /fd sha256 "$unpackedPath\VS Code Egypt.exe"
} else {
    Write-Warning "CODE_SIGN_CERT_PATH / CODE_SIGN_CERT_PASSWORD not set — producing an UNSIGNED build. Users will see a Windows security warning on install."
}

# --- Step 4: build the installer with Inno Setup ---
# Requires Inno Setup installed: https://jrsoftware.org/isinfo.php
# VSCodium's real Windows packaging uses an .iss script under build/windows/ —
# see build-windows.iss alongside this file for the actual installer definition.
$iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $iscc)) {
    Write-Error "Inno Setup Compiler not found at $iscc. Install Inno Setup 6 first."
    exit 1
}

Write-Host "-- Building .exe installer..." -ForegroundColor Cyan
& $iscc "build-windows.iss" /DAppPath="$unpackedPath"

Write-Host "== Done. Installer output in .\dist\ ==" -ForegroundColor Green
Write-Host "NOTE: For an .msi instead of/alongside the Inno .exe, use the WiX Toolset (v3 or v4) with a separate .wxs definition — not covered by this script, since VSCodium's own release pipeline ships .exe (Inno) and a .zip, not .msi, by default."
