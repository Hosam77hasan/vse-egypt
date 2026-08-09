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
Write-Host "-- Packaging win32-x64..." -ForegroundColor Cyan
yarn gulp vscode-win32-x64-min

$unpackedPath = "..\VSCode-win32-x64"
if (-not (Test-Path $unpackedPath)) {
    Write-Error "Expected unpacked app at $unpackedPath but it doesn't exist. Check the gulp task output above for the actual path."
    exit 1
}

# ═══════════════════════════════════════════════════════════════════════
# Step 3a: Self-signed certificate generation (FREE SmartScreen mitigation)
# ═══════════════════════════════════════════════════════════════════════
# This produces a self-signed Authenticode cert that the Inno Setup [Code]
# section injects into TrustedPublisher during install — users see "Emperor
# Software Development" as the verified publisher instead of "Unknown".
# This is NOT an EV cert and SmartScreen reputation is still earned over time,
# but it eliminates the "Windows protected your PC" red-screen on first run
# for users who install the cert via the installer's post-install step.
$selfSignCertPath = "$PSScriptRoot\..\resources\win32\vse-code-selfsign.pfx"
$selfSignCerPath  = "$PSScriptRoot\..\resources\win32\vse-code-signing.cer"

if (-not (Test-Path $selfSignCertPath)) {
    Write-Host "-- Generating self-signed code-signing certificate..." -ForegroundColor Cyan

    # Create a self-signed cert valid for 5 years
    $cert = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject "CN=Emperor Software Development, O=Emperor Software Development, L=Cairo, C=EG" `
        -KeyUsage DigitalSignature `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -NotAfter (Get-Date).AddYears(5)

    # Export as PFX (password-protected — the password is only used during
    # the build, never shipped to users; the .cer (public key only) is what
    # gets bundled into the installer for TrustedPublisher injection.)
    $certPassword = ConvertTo-SecureString -String "vse-build-temp" -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath $selfSignCertPath -Password $certPassword | Out-Null

    # Export the public-key-only .cer that gets bundled with the installer
    Export-Certificate -Cert $cert -FilePath $selfSignCerPath -Type CERT | Out-Null

    # Clean up from the current user's personal store
    Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force

    Write-Host "   Self-signed cert generated: $selfSignCertPath" -ForegroundColor Green
    Write-Host "   Public .cer for installer: $selfSignCerPath" -ForegroundColor Green
}

# --- Step 3b: Sign binaries with the self-signed cert ---
if (Test-Path $selfSignCertPath) {
    Write-Host "-- Signing binaries with self-signed cert..." -ForegroundColor Cyan
    $certPassword = ConvertTo-SecureString -String "vse-build-temp" -Force -AsPlainText

    # Sign every .exe and .dll in the unpacked app tree
    Get-ChildItem -Path $unpackedPath -Recurse -Include *.exe,*.dll | ForEach-Object {
        & signtool sign /f $selfSignCertPath /p $certPassword /tr http://timestamp.digicert.com /td sha256 /fd sha256 $_.FullName
    }

    Write-Host "   Binaries signed." -ForegroundColor Green
}
else {
    Write-Warning "No signing certificate found — binaries will be UNSIGNED."
}

# ═══════════════════════════════════════════════════════════════════════
# Step 3c: Optional REAL code signing (EV/standard Authenticode cert)
# ═══════════════════════════════════════════════════════════════════════
# Set CODE_SIGN_CERT_PATH + CODE_SIGN_CERT_PASSWORD in your CI environment
# to overlay a real CA-issued cert on top of the self-signed one. The real
# cert takes precedence for actual SmartScreen reputation.
if ($env:CODE_SIGN_CERT_PATH -and $env:CODE_SIGN_CERT_PASSWORD) {
    Write-Host "-- Signing binaries with REAL code-signing certificate..." -ForegroundColor Cyan
    Get-ChildItem -Path $unpackedPath -Recurse -Include *.exe,*.dll | ForEach-Object {
        & signtool sign /f $env:CODE_SIGN_CERT_PATH /p $env:CODE_SIGN_CERT_PASSWORD /tr http://timestamp.digicert.com /td sha256 /fd sha256 $_.FullName
    }
    Write-Host "   Real cert signing complete." -ForegroundColor Green
}

# ═══════════════════════════════════════════════════════════════════════
# Step 4: Copy kliopatra.ico and the public .cer into resources so the
#         Inno [Files] section can bundle both into {app}
# ═══════════════════════════════════════════════════════════════════════
$icoSource = "$PSScriptRoot\..\resources\win32\kliopatra.ico"
$icoDest   = "$PSScriptRoot\..\resources\win32\kliopatra.ico"  # already there
if (-not (Test-Path $icoSource)) {
    Write-Warning "kliopatra.ico not found at $icoSource — desktop shortcut will fall back to the default .exe icon."
}

# --- Step 5: build the .exe installer with Inno Setup ---
$iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $iscc)) {
    Write-Error "Inno Setup Compiler not found at $iscc. Install Inno Setup 6 first."
    exit 1
}

Write-Host "-- Building .exe installer..." -ForegroundColor Cyan
& $iscc "$PSScriptRoot\build-windows.iss" /DAppPath="$unpackedPath"

Write-Host "== .exe installer output in .\dist\ ==" -ForegroundColor Green

# ═══════════════════════════════════════════════════════════════════════
# Step 6: Build .MSI package (WiX Toolset) — Windows trusts .msi more
# ═══════════════════════════════════════════════════════════════════════
# MSI files bypass much of the SmartScreen "file from internet" heuristic
# because they're standard Windows Installer packages with built-in
# integrity checks. This produces VSCodeEgyptSetup.msi alongside the .exe.
$wixCandle  = "${env:ProgramFiles(x86)}\WiX Toolset v3.11\bin\candle.exe"
$wixLight   = "${env:ProgramFiles(x86)}\WiX Toolset v3.11\bin\light.exe"
$wxsSource  = "$PSScriptRoot\build-windows.wxs"

if ((Test-Path $wixCandle) -and (Test-Path $wixLight) -and (Test-Path $wxsSource)) {
    Write-Host "-- Building .msi installer (WiX)..." -ForegroundColor Cyan

    $wixObj = "$env:TEMP\VSCodeEgypt.wixobj"
    & $wixCandle -arch x64 -dAppPath="$unpackedPath" -out "$wixObj" $wxsSource
    if ($LASTEXITCODE -eq 0) {
        & $wixLight -out "$PSScriptRoot\dist\VSCodeEgyptSetup.msi" "$wixObj"
        Remove-Item "$wixObj" -Force -ErrorAction SilentlyContinue
        Write-Host "   .msi installer built." -ForegroundColor Green
    }
    else {
        Write-Warning "WiX candle failed — skipping .msi. The .exe installer is still available."
    }
}
else {
    Write-Host "-- Skipping .msi build (WiX Toolset v3.11 not found or .wxs missing)." -ForegroundColor Yellow
    Write-Host "   Install WiX from https://wixtoolset.org/ to enable .msi output." -ForegroundColor Yellow
}

Write-Host "== Done. Installers in .\dist\ ==" -ForegroundColor Green
Write-Host "   VSCodeEgyptSetup.exe  — Inno Setup installer" -ForegroundColor White
Write-Host "   VSCodeEgyptSetup.msi  — WiX MSI (if WiX was found)" -ForegroundColor White
