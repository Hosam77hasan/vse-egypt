# setup-local-dev.ps1
# ============================================================================
#  سكريبت إعداد بيئة التطوير المحلي لـ VS Code Egypt
#  يحمّل VSCodium Portable ويطبق كل التعديلات — بدون بناء كامل
#
#  طريقة التشغيل (PowerShell عادي، مش محتاج Administrator):
#    powershell -ExecutionPolicy Bypass -File scripts/setup-local-dev.ps1
#
#  بعد ما يخلص، شغّل:
#    .\vscode-egypt-dev\VS Code Egypt.exe
# ============================================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent (Get-Item $PSCommandPath).Path
$RepoRoot = Split-Path -Parent $ScriptDir
$DevDir = Join-Path $RepoRoot "vscode-egypt-dev"
$VSCodiumVersion = "1.126.04524"
$VSCodiumUrl = "https://github.com/VSCodium/vscodium/releases/download/$VSCodiumVersion/VSCodium-win32-x64-$VSCodiumVersion.zip"
$VSCodiumZip = Join-Path $env:TEMP "vscodium-dev.zip"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   VS Code Egypt — إعداد التطوير المحلي" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ----------------------------------------------------------------------------
# الخطوة 1: تحميل VSCodium Portable
# ----------------------------------------------------------------------------
Write-Host "==> 1/5 - تحميل VSCodium $VSCodiumVersion ..." -ForegroundColor Green

if (Test-Path $DevDir) {
    Write-Host "    مجلد التطوير موجود بالفعل: $DevDir" -ForegroundColor Gray
    $overwrite = Read-Host "    هل تريد إعادة البناء من الصفر؟ (y/n, افتراضي: n)"
    if ($overwrite -eq 'y') {
        Remove-Item $DevDir -Recurse -Force
        Write-Host "    تم حذف المجلد القديم." -ForegroundColor Gray
    } else {
        Write-Host "    تخطي التحميل — المجلد موجود." -ForegroundColor Gray
        goto SkipDownload
    }
}

if (-not (Test-Path $VSCodiumZip)) {
    Write-Host "    بيتم التحميل من GitHub ... (حوالي 120MB)" -ForegroundColor Gray
    try {
        Invoke-WebRequest -Uri $VSCodiumUrl -OutFile $VSCodiumZip -ErrorAction Stop
    } catch {
        Write-Host "    فشل التحميل. بتجربة الرابط البديل..." -ForegroundColor Yellow
        # Fallback: try without version patch
        $VSCodiumUrlAlt = "https://github.com/VSCodium/vscodium/releases/download/1.126.04524/VSCodium-win32-x64-1.126.04524.zip"
        Invoke-WebRequest -Uri $VSCodiumUrlAlt -OutFile $VSCodiumZip
    }
    Write-Host "    تم التحميل." -ForegroundColor Gray
} else {
    Write-Host "    ملف التحميل موجود مسبقاً." -ForegroundColor Gray
}

# ----------------------------------------------------------------------------
# الخطوة 2: فك الضغط
# ----------------------------------------------------------------------------
Write-Host "==> 2/5 - فك ضغط VSCodium ..." -ForegroundColor Green
New-Item -ItemType Directory -Path $DevDir -Force | Out-Null
Expand-Archive -Path $VSCodiumZip -DestinationPath $DevDir -Force
Write-Host "    تم فك الضغط." -ForegroundColor Gray

# ----------------------------------------------------------------------------
# الخطوة 3: تطبيق التعديلات (branding + product.json)
# ----------------------------------------------------------------------------
Write-Host "==> 3/5 - تطبيق الهوية والتعديلات ..." -ForegroundColor Green

# إيجاد product.json داخل VSCodium المفكوك
$productJsonPath = Get-ChildItem $DevDir -Recurse -Filter "product.json" | Select-Object -First 1

if (-not $productJsonPath) {
    Write-Host "خطأ: لم يتم العثور على product.json داخل $DevDir" -ForegroundColor Red
    Get-ChildItem $DevDir -Directory | Select-Object Name
    exit 1
}

Write-Host "    product.json موجود في: $($productJsonPath.FullName)" -ForegroundColor Gray

# قراءة product.json الأصلي من VSCodium
$pj = Get-Content $productJsonPath.FullName -Raw | ConvertFrom-Json

# حقن الهوية
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

# حقن الإعدادات الافتراضية
$defaults = @{
    # ── الثيم ──
    "workbench.colorTheme" = "VS Code Egypt Lime"

    # ── إلغاء Restricted Mode تماماً ──
    "security.workspace.trust.enabled" = $false
    "security.workspace.trust.startupPrompt" = "never"
    "security.workspace.trust.banner" = "never"
    "security.workspace.trust.emptyWindow" = $false

    # ── شريط العنوان وأزرار الإغلاق ──
    "window.titleBarStyle" = "native"
    "window.commandCenter" = $false

    # ── الشريط الجانبي ──
    "workbench.activityBar.visible" = $true
    "workbench.sideBar.location" = "left"

    # ── الإضافات ──
    "extensions.ignoreRecommendations" = $false
    "extensions.autoUpdate" = $true
    "extensions.autoCheckUpdates" = $true

    # ── تعطيل الإزعاجات ──
    "workbench.startupEditor" = "none"
    "workbench.enableExperiments" = $false
    "workbench.layoutControl.enabled" = $false

    # ── الخصوصية ──
    "telemetry.telemetryLevel" = "off"
    "update.mode" = "none"

    # ── تعطيل أدوات AI المنافسة ──
    "chat.enabled" = $false
    "github.copilot.enable" = @{}
    "editor.inlineSuggest.enabled" = $false
}

$pj | Add-Member -MemberType NoteProperty -Name 'configurationDefaults' -Value $defaults -Force

# حقن قائمة حظر إضافات AI
$blocklist = @(
    "github.copilot", "github.copilot-chat", "github.copilot-nightly",
    "tabnine.tabnine-vscode", "tabnine.tabnine-vscode-self-hosted-updater",
    "codeium.codeium", "codeium.codeium-enterprise-updater", "codeium.windsurf",
    "amazonwebservices.amazon-q-vscode", "aws.toolkit",
    "continue.continue", "sourcegraph.cody-ai", "sourcegraph.cody-aichat",
    "google.geminicodeassist", "googlecloud.gemini-code-assist",
    "saoudrizwan.claude-dev", "kodu-ai.claude-coder", "anthropic.claude-code",
    "cursor.cursor", "supercomplete.supermaven", "blackboxapp.blackbox",
    "codegpt.codegpt", "bito.bito"
)
$pj | Add-Member -MemberType NoteProperty -Name 'extensionAiBlocklist' -Value $blocklist -Force

# حقن الإضافات المدمجة
$builtIn = @(
    @{ name = "vscode-egypt-theme"; publisher = "vscode-egypt"; version = "1.0.0" }
)
$pj | Add-Member -MemberType NoteProperty -Name 'builtInExtensions' -Value $builtIn -Force

# حفظ
$pj | ConvertTo-Json -Depth 100 | Out-File -FilePath $productJsonPath.FullName -Encoding utf8
Write-Host "    تم تحديث product.json بـ:" -ForegroundColor Gray
Write-Host "      - الهوية (VS Code Egypt)" -ForegroundColor Gray
Write-Host "      - إلغاء Restricted Mode" -ForegroundColor Gray
Write-Host "      - window.titleBarStyle: native" -ForegroundColor Gray
Write-Host "      - الثيم الافتراضي: VS Code Egypt Lime" -ForegroundColor Gray
Write-Host "      - قائمة حظر AI (23 إضافة)" -ForegroundColor Gray

# ----------------------------------------------------------------------------
# الخطوة 4: نسخ الثيم والإضافات
# ----------------------------------------------------------------------------
Write-Host "==> 4/5 - نسخ الثيم والإضافات المدمجة ..." -ForegroundColor Green

# إيجاد مجلد extensions داخل VSCodium
$extDir = Get-ChildItem $DevDir -Recurse -Directory -Filter "extensions" |
    Where-Object { $_.FullName -match "resources\\app\\extensions$" } |
    Select-Object -First 1

if (-not $extDir) {
    # إنشاء المجلد إذا لم يكن موجوداً
    $resourcesApp = Get-ChildItem $DevDir -Recurse -Directory -Filter "app" |
        Where-Object { $_.FullName -match "resources\\app$" } |
        Select-Object -First 1
    if ($resourcesApp) {
        $extDir = Join-Path $resourcesApp.FullName "extensions"
        New-Item -ItemType Directory -Path $extDir -Force | Out-Null
    }
}

if ($extDir) {
    # نسخ الثيم
    $themeSrc = Join-Path $RepoRoot "extensions\vscode-egypt-theme"
    $themeDest = Join-Path $extDir.FullName "vscode-egypt-theme"
    if (Test-Path $themeSrc) {
        Copy-Item $themeSrc $themeDest -Recurse -Force
        Write-Host "    الثيم الليموني: تم النسخ إلى resources/app/extensions/" -ForegroundColor Gray
    }

    # نسخ إضافة AI
    $aiExtSrc = Join-Path $RepoRoot "vse-extension\editor"
    $aiExtDest = Join-Path $extDir.FullName "vse-egypt-ai"
    if (Test-Path $aiExtSrc) {
        Copy-Item $aiExtSrc $aiExtDest -Recurse -Force
        Write-Host "    إضافة AI: تم النسخ إلى resources/app/extensions/" -ForegroundColor Gray
    }
} else {
    Write-Host "    تحذير: لم يتم العثور على مجلد extensions داخل VSCodium" -ForegroundColor Yellow
    Write-Host "    سيتم تخطي نسخ الثيم (يمكن نسخه يدوياً لاحقاً)" -ForegroundColor Yellow
}

# ----------------------------------------------------------------------------
# الخطوة 5: إعادة تسمية الملف التنفيذي ونسخ الأيقونة
# ----------------------------------------------------------------------------
Write-Host "==> 5/5 - تجهيز الأيقونة والملف التنفيذي ..." -ForegroundColor Green

# نسخ أيقونة كليوباترا
$icoSrc = Join-Path $RepoRoot "resources\win32\kliopatra.ico"
if (Test-Path $icoSrc) {
    Copy-Item $icoSrc (Join-Path $DevDir "kliopatra.ico") -Force
    Write-Host "    kliopatra.ico: تم النسخ إلى جذر التطبيق" -ForegroundColor Gray
}

# إيجاد وإعادة تسمية الملف التنفيذي
$exe = Get-ChildItem $DevDir -Recurse -Include "VSCodium.exe", "codium.exe" |
    Where-Object { $_.DirectoryName -notmatch '\\bin[\\$]' } |
    Sort-Object Length -Descending |
    Select-Object -First 1

if ($exe) {
    $sizeMB = [math]::Round($exe.Length / 1MB, 1)
    Write-Host "    الملف التنفيذي: $($exe.Name) ($sizeMB MB)" -ForegroundColor Gray
    $newExePath = Join-Path (Split-Path $exe.FullName -Parent) "VS Code Egypt.exe"
    if ($exe.Name -ne "VS Code Egypt.exe") {
        Rename-Item $exe.FullName "VS Code Egypt.exe" -ErrorAction SilentlyContinue
        Write-Host "    تم إعادة التسمية إلى: VS Code Egypt.exe" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   خلصنا! التطبيق جاهز للتشغيل." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "   للتشغيل:" -ForegroundColor Cyan
Write-Host "     .\vscode-egypt-dev\VS Code Egypt.exe" -ForegroundColor White
Write-Host ""
Write-Host "   لتشغيل الباك إند (مطلوب للـ AI):" -ForegroundColor Cyan
Write-Host "     cd vse-backend && npm start" -ForegroundColor White
Write-Host ""

SkipDownload:
Write-Host "   التطبيق موجود في: $DevDir" -ForegroundColor Gray
Write-Host ""
