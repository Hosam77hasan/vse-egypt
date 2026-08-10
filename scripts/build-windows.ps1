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
# =========================================================================================

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
$selfSignCertPath = "$PSScriptRoot\..\resources\win32\vse-code-selfsign.pfx"
$selfSignCerPath  = "$PSScriptRoot\..\resources\win32\vse-code-signing.cer"

if (-not (Test-Path $selfSignCertPath)) {
    Write-Host "-- Generating self-signed code-signing certificate..." -ForegroundColor Cyan

    $cert = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject "CN=Emperor Software Development, O=Emperor Software Development, L=Cairo, C=EG" `
        -KeyUsage DigitalSignature `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -NotAfter (Get-Date).AddYears(5)

    $certPassword = ConvertTo-SecureString -String "vse-build-temp" -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath $selfSignCertPath -Password $certPassword | Out-Null
    Export-Certificate -Cert $cert -FilePath $selfSignCerPath -Type CERT | Out-Null
    Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force

    Write-Host "   Self-signed cert generated: $selfSignCertPath" -ForegroundColor Green
    Write-Host "   Public .cer for installer: $selfSignCerPath" -ForegroundColor Green
}

# --- Step 3b: Sign binaries with the self-signed cert ---
if (Test-Path $selfSignCertPath) {
    Write-Host "-- Signing binaries with self-signed cert..." -ForegroundColor Cyan
    $certPassword = ConvertTo-SecureString -String "vse-build-temp" -Force -AsPlainText

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
if ($env:CODE_SIGN_CERT_PATH -and $env:CODE_SIGN_CERT_PASSWORD) {
    Write-Host "-- Signing binaries with REAL code-signing certificate..." -ForegroundColor Cyan
    Get-ChildItem -Path $unpackedPath -Recurse -Include *.exe,*.dll | ForEach-Object {
        & signtool sign /f $env:CODE_SIGN_CERT_PATH /p $env:CODE_SIGN_CERT_PASSWORD /tr http://timestamp.digicert.com /td sha256 /fd sha256 $_.FullName
    }
    Write-Host "   Real cert signing complete." -ForegroundColor Green
}

# ═══════════════════════════════════════════════════════════════════════
# Step 3d: Inject branding + default settings into product.json
# ═══════════════════════════════════════════════════════════════════════
Write-Host "-- Injecting branding + default settings into product.json..." -ForegroundColor Cyan

$productJsonPath = Get-ChildItem $unpackedPath -Recurse -Filter "product.json" | Select-Object -First 1
if ($productJsonPath) {
    $pj = Get-Content $productJsonPath.FullName -Raw | ConvertFrom-Json

    # Branding
    $pj.nameShort = "VSCodeEgypt"
    $pj.nameLong = "VS Code Egypt"
    $pj.win32DirName = "VS Code Egypt"
    $pj.win32NameVersion = "VS Code Egypt"
    $pj.win32RegValueName = "VSCodeEgypt"
    $pj.win32ShellNameShort = "VS Code Egypt"
    $pj.win32AppUserModelId = "VSCodeEgypt.VSCodeEgypt"
    $pj.win32MutexName = "vscodeegypt"
    $pj.applicationName = "vscode-egypt"
    $pj.dataFolderName = ".vscode-egypt"
    $pj.urlProtocol = "vscode-egypt"
    $pj.darwinBundleIdentifier = "com.vscodeegypt.app"
    $pj.linuxIconName = "vscode-egypt"

    # Default settings
    $defaults = @{
        "security.workspace.trust.enabled" = $false
        "security.workspace.trust.startupPrompt" = "never"
        "security.workspace.trust.banner" = "never"
        "security.workspace.trust.emptyWindow" = $false
        "workbench.colorTheme" = "VS Code Egypt Lime"
        "workbench.activityBar.visible" = $true
        "workbench.sideBar.location" = "left"
        "extensions.ignoreRecommendations" = $false
        "extensions.autoUpdate" = $true
        "workbench.startupEditor" = "none"
        "workbench.enableExperiments" = $false
        "telemetry.telemetryLevel" = "off"
        "update.mode" = "none"
        "chat.enabled" = $false
        "github.copilot.enable" = @{}
        "editor.inlineSuggest.enabled" = $false
    }
    $pj | Add-Member -MemberType NoteProperty -Name 'configurationDefaults' -Value $defaults -Force -ErrorAction SilentlyContinue

    # Built-in extensions
    $pj | Add-Member -MemberType NoteProperty -Name 'builtInExtensions' -Value @(@{ name = "vscode-egypt-theme"; publisher = "vscode-egypt"; version = "1.0.0" }) -Force

    # AI blocklist
    $blocklist = @(
        "github.copilot", "github.copilot-chat", "tabnine.tabnine-vscode",
        "codeium.codeium", "amazonwebservices.amazon-q-vscode", "continue.continue",
        "sourcegraph.cody-ai", "google.geminicodeassist", "saoudrizwan.claude-dev",
        "kodu-ai.claude-coder", "anthropic.claude-code", "cursor.cursor"
    )
    $pj | Add-Member -MemberType NoteProperty -Name 'extensionAiBlocklist' -Value $blocklist -Force

    $pj | ConvertTo-Json -Depth 100 | Out-File -FilePath $productJsonPath.FullName -Encoding utf8
    Write-Host "   product.json branded with configurationDefaults" -ForegroundColor Green
} else {
    Write-Warning "product.json not found in unpacked app"
}

# ═══════════════════════════════════════════════════════════════════════
# Step 4: Copy kliopatra.ico, theme extension, and AI extension
# ═══════════════════════════════════════════════════════════════════════

# Copy kliopatra.ico into the unpacked app root
$icoSource = "$PSScriptRoot\..\resources\win32\kliopatra.ico"
$icoDest   = "$unpackedPath\kliopatra.ico"
if (Test-Path $icoSource) {
    Copy-Item $icoSource $icoDest -Force
    Write-Host "   kliopatra.ico copied to app root" -ForegroundColor Green
} else {
    Write-Warning "kliopatra.ico not found at $icoSource — desktop shortcut will fall back to the default .exe icon."
}

# Copy theme extension into built-in extensions
$themeSrc = "$PSScriptRoot\..\extensions\vscode-egypt-theme"
$themeDest = "$unpackedPath\resources\app\extensions\vscode-egypt-theme"
if (Test-Path $themeSrc) {
    $destDir = Split-Path $themeDest -Parent
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item $themeSrc $themeDest -Recurse -Force
    Write-Host "   Theme extension copied to: $themeDest" -ForegroundColor Green
} else {
    Write-Warning "Theme source not found at $themeSrc"
}

# Copy AI extension into built-in extensions
$aiExtSrc = "$PSScriptRoot\..\vse-extension\editor"
$aiExtDest = "$unpackedPath\resources\app\extensions\vse-egypt-ai"
if (Test-Path $aiExtSrc) {
    $destDir = Split-Path $aiExtDest -Parent
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item $aiExtSrc $aiExtDest -Recurse -Force
    Write-Host "   AI extension copied to: $aiExtDest" -ForegroundColor Green
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
