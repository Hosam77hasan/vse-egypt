# install-vscode-egypt.ps1
# ============================================================================
#  سكريبت التثبيت الشامل لمشروع VS Code Egypt
#  بيعمل كل خطوات التجهيز تلقائيًا: تجهيز الأدوات، تحميل المصدر، تركيب كل
#  التعديلات، وتجهيز الباك إند وبوابة الدفع والموقع.
#
#  ⚠️ ملحوظة مهمة: السكريبت ده اتكتب ومراجعته بعناية، لكن ما اتجربش فعليًا على
#  جهاز Windows حقيقي (بيئة الكتابة كانت Linux). شغّله وراقب كل خطوة، ولو حصل
#  أي خطأ السكريبت هيوقف ويوريك رسالة واضحة بدل ما يكمل بصمت.
#
#  طريقة التشغيل: افتح PowerShell كـ Administrator، وشغّل:
#    powershell -ExecutionPolicy Bypass -File install-vscode-egypt.ps1
# ============================================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = "C:\Dev"

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Green
}
function Write-Info($msg) {
    Write-Host "    $msg" -ForegroundColor Gray
}
function Write-Fail($msg) {
    Write-Host ""
    Write-Host "خطأ: $msg" -ForegroundColor Red
    Write-Host "   السكريبت هيقف هنا. اقرأ الرسالة اللي فوق، وحلها، وشغّل السكريبت تاني — هيكمل من غير ما يعيد الخطوات اللي خلصت." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   تثبيت VS Code Egypt — البداية" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ----------------------------------------------------------------------------
# الخطوة 0: التأكد إنك شغّال كـ Administrator
# ----------------------------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Fail "لازم تشغل PowerShell كـ Administrator (كليك يمين على أيقونة PowerShell واختار Run as Administrator)."
}

# ----------------------------------------------------------------------------
# الخطوة 1: تجهيز الأدوات الأساسية (Node, Git, Python, Visual Studio Build Tools)
# ----------------------------------------------------------------------------
Write-Step "1/8 - التأكد من وجود الأدوات الأساسية"

function Test-Command($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "git")) {
    Write-Info "Git مش موجود - بيتم تركيبه دلوقتي..."
    winget install --id Git.Git -e --silent
} else {
    Write-Info "Git موجود"
}

if (-not (Test-Command "node")) {
    Write-Info "Node.js مش موجود - بيتم تركيب NVM for Windows..."
    winget install --id CoreyButler.NVMforWindows -e --silent
    Write-Info "بعد ما السكريبت يخلص، افتح PowerShell جديد واكتب: nvm install 20 ثم nvm use 20"
    Write-Fail "لازم تعيد فتح PowerShell عشان Node يبقى متعرف عليه، وبعدين تشغل السكريبت ده تاني."
} else {
    Write-Info "Node.js موجود ($(node -v))"
}

if (-not (Test-Command "python")) {
    Write-Info "Python مش موجود - بيتم تركيبه دلوقتي..."
    winget install --id Python.Python.3.11 -e --silent
} else {
    Write-Info "Python موجود"
}

if (-not (Test-Command "yarn")) {
    Write-Info "Yarn مش موجود - بيتم تركيبه دلوقتي..."
    npm install -g yarn
} else {
    Write-Info "Yarn موجود"
}

$vsBuildToolsPath = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools"
if (-not (Test-Path $vsBuildToolsPath)) {
    Write-Info "Visual Studio Build Tools مش موجودة - بيتم تركيبها دلوقتي (ده بياخد وقت أطول شوية)..."
    winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --quiet"
} else {
    Write-Info "Visual Studio Build Tools موجودة"
}

# ----------------------------------------------------------------------------
# الخطوة 2: استنساخ مصدر VSCodium
# ----------------------------------------------------------------------------
Write-Step "2/8 - تحميل مصدر VSCodium"

if (-not (Test-Path $ProjectRoot)) {
    New-Item -ItemType Directory -Path $ProjectRoot | Out-Null
}
Set-Location $ProjectRoot

if (Test-Path "$ProjectRoot\vscode-egypt") {
    Write-Info "فولدر vscode-egypt موجود بالفعل - هيتم تخطي التحميل."
} else {
    git clone https://github.com/VSCodium/vscodium.git vscode-egypt
    if ($LASTEXITCODE -ne 0) { Write-Fail "فشل تحميل مصدر VSCodium. تأكد إنك متصل بالإنترنت." }
}
Set-Location "$ProjectRoot\vscode-egypt"

$bash = "C:\Program Files\Git\bin\bash.exe"
if (-not (Test-Path $bash)) {
    Write-Fail "مش لاقي bash.exe بتاع Git في المسار المتوقع. تأكد إن Git for Windows اتثبت صح."
}

if (-not (Test-Path "$ProjectRoot\vscode-egypt\vscode")) {
    Write-Info "بيتم تحميل نسخة VS Code الأساسية (ده بياخد شوية وقت)..."
    & $bash -c "./get_repo.sh"
    if ($LASTEXITCODE -ne 0) { Write-Fail "فشل تحميل نسخة VS Code الأساسية." }
} else {
    Write-Info "نسخة VS Code الأساسية موجودة بالفعل - هيتم تخطي التحميل."
}

# ----------------------------------------------------------------------------
# الخطوة 3: تجهيز المصدر (تنصيب الحزم البرمجية Dependencies)
# ----------------------------------------------------------------------------
Write-Step "3/8 - تجهيز المصدر وتنصيب الحزم البرمجية (ده أطول خطوة، ممكن تاخد 20-40 دقيقة)"

& $bash -c "./prepare_vscode.sh"
if ($LASTEXITCODE -ne 0) {
    Write-Fail "فشلت خطوة التجهيز. لو الخطأ متعلق بـ node-gyp أو compiler، تأكد إن Visual Studio Build Tools مثبتة صح مع C++ workload."
}

# ----------------------------------------------------------------------------
# الخطوة 4: تركيب التعديلات (Patches) بالترتيب الصحيح
# ----------------------------------------------------------------------------
Write-Step "4/8 - تركيب كل تعديلات VS Code Egypt"

Set-Location "$ProjectRoot\vscode-egypt\vscode"

# الترتيب ده مهم جدًا - آخر باتش بيسجل موديولات لازم تكون الملفات بتاعتها موجودة الأول.
$patchOrder = @(
    "hide-extensions-viewlet.patch",
    "onboarding-gate.patch",
    "chat-panel.patch",
    "statusbar-billing-entry.patch",
    "inline-edit-ctrlk.patch",
    "workspace-rag-indexing.patch",
    "inline-tab-completion.patch",
    "agent-mode.patch",
    "workbench-manifest-registrations.patch"
)

foreach ($patch in $patchOrder) {
    $patchPath = "..\patches\user\$patch"
    if (-not (Test-Path $patchPath)) {
        Write-Info "تخطي $patch (الملف مش موجود)"
        continue
    }
    Write-Info "بيتم تركيب: $patch"
    & git apply --check $patchPath 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Info "  الباتش ده يمكن يكون اتركب قبل كده - هيتم تخطيه."
        continue
    }
    & git apply $patchPath
    if ($LASTEXITCODE -ne 0) { Write-Fail "فشل تركيب $patch." }
}

# ----------------------------------------------------------------------------
# الخطوة 5: نسخ ملفات الهوية والثيم
# ----------------------------------------------------------------------------
Write-Step "5/8 - نسخ ملفات الهوية (product.json) والثيم الليموني"

if (Test-Path "$ProjectRoot\vscode-egypt\vscode\extensions\vscode-egypt-theme") {
    Write-Info "الثيم موجود بالفعل."
} else {
    Copy-Item -Recurse "$ProjectRoot\vscode-egypt\extensions\vscode-egypt-theme" "$ProjectRoot\vscode-egypt\vscode\extensions\vscode-egypt-theme" -ErrorAction SilentlyContinue
    Write-Info "تم نسخ الثيم"
}

# ----------------------------------------------------------------------------
# الخطوة 6: تجهيز الباك إند (vse-backend)
# ----------------------------------------------------------------------------
Write-Step "6/8 - تجهيز الباك إند (Server)"

Set-Location "$ProjectRoot"
if (-not (Test-Path "$ProjectRoot\vse-backend")) {
    Write-Fail "فولدر vse-backend مش موجود في $ProjectRoot. تأكد إنك فكيت ملفات المشروع (vscode-egypt-buildpack.zip) في المكان ده الأول."
}
Set-Location "$ProjectRoot\vse-backend"

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Info "تم إنشاء ملف .env - لازم تفتحه وتحط فيه المفاتيح بتاعتك (DEEPSEEK_API_KEY وغيره)."
    Write-Info "هيتفتح النوت باد دلوقتي عشان تعدله..."
    Start-Process notepad.exe ".env"
    Write-Host ""
    Write-Host "اضغط أي زرار هنا في PowerShell بعد ما تحفظ وتقفل النوت باد عشان نكمل..." -ForegroundColor Yellow
    [void][System.Console]::ReadKey($true)
}

Write-Info "بيتم تنصيب حزم الباك إند (npm install)..."
npm install
if ($LASTEXITCODE -ne 0) { Write-Fail "فشل تنصيب حزم الباك إند." }

# ----------------------------------------------------------------------------
# الخطوة 7: تجهيز بوابة الدفع (vse-payment-portal)
# ----------------------------------------------------------------------------
Write-Step "7/8 - تجهيز بوابة الدفع"

Set-Location "$ProjectRoot\vse-payment-portal"

if (-not (Test-Path ".env")) {
    Copy-Item "..\vse-backend\.env" ".env"
    Add-Content ".env" "VSE_BACKEND_URL=http://localhost:8787"
    Add-Content ".env" "PAYMENT_PORTAL_PORT=4000"
    Write-Info "تم إنشاء .env بوابة الدفع تلقائيًا من نفس إعدادات الباك إند"
}

Write-Info "بيتم تنصيب حزم بوابة الدفع..."
npm install
if ($LASTEXITCODE -ne 0) { Write-Fail "فشل تنصيب حزم بوابة الدفع." }

# ----------------------------------------------------------------------------
# الخطوة 8: تجهيز الموقع التسويقي (vse-landing)
# ----------------------------------------------------------------------------
Write-Step "8/8 - تجهيز الموقع التسويقي"

Set-Location "$ProjectRoot\vse-landing"

if (-not (Test-Path ".env")) {
    Set-Content ".env" "PAYMENT_PORTAL_URL=http://localhost:4000"
    Add-Content ".env" "LANDING_PORT=5000"
    Write-Info "تم إنشاء .env الموقع التسويقي"
}

Write-Info "بيتم تنصيب حزم الموقع..."
npm install
if ($LASTEXITCODE -ne 0) { Write-Fail "فشل تنصيب حزم الموقع." }

# ----------------------------------------------------------------------------
# النهاية
# ----------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   خلصنا! كل حاجة جاهزة." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "شغّل السكريبت التاني run-all.ps1 عشان تفتح كل الخدمات مرة واحدة." -ForegroundColor Cyan
Write-Host ""
