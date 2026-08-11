# 🏛️ VS Code Egypt — Handoff Document

## 🚀 تشغيل التطبيق حالياً

```powershell
Start-Process -FilePath "D:\project\vscode-egypt-buildpack-session4\vscode-egypt\vscode-egypt-dev\VS Code Egypt.exe"
```

التطبيق في **Portable Mode** — كل الإعدادات محفوظة في `vscode-egypt-dev\data\`.

## 📁 هيكل المشروع

```
vscode-egypt/
├── vscode-egypt-dev/          ← التطبيق الجاهز (Pre-built + تعديلاتنا)
│   ├── VS Code Egypt.exe      ← الملف التنفيذي
│   ├── data/                  ← Portable Mode (الإعدادات المحلية)
│   │   └── user-data/User/settings.json
│   ├── resources/app/
│   │   ├── product.json       ← branding + configurationDefaults
│   │   └── extensions/
│   │       ├── vse-egypt-theme/   ← إضافة الثيم الليموني
│   │       └── vse-egypt-ai/      ← إضافة AI Agent sidebar
│   └── kliopatra.ico
│
├── product.json               ← ملف الهوية الرئيسي (للبناء)
├── extensions/
│   └── vscode-egypt-theme/    ← سورس الثيم (للنسخ)
├── vse-extension/editor/      ← فلتر حظر AI (ليس extension)
├── patches/user/              ← 9 ب patches لسورس VSCodium
├── scripts/
├── vse-backend/               ← الباك إند (DeepSeek proxy)
├── vse-landing/
└── vse-payment-portal/

D:\Dev\vscodium-source\vscode\  ← سورس VSCodium كامل (للتطوير)
```

## 🔧 طريقة التطوير (Hot Reload)

لتفعيل Hot Reload وتشغيل التطبيق من السورس مع تغييرات لحظية:

```powershell
# 1. استخدام Node 24
$env:PATH = "C:\Users\elhos\.node24\node-v24.11.1-win-x64;" + $env:PATH

# 2. الدخول لمجلد السورس
cd D:\Dev\vscodium-source\vscode

# 3. تشغيل watch mode (يفتح Electron + hot reload)
$env:VSCODE_SKIP_NODE_VERSION_CHECK = "1"
npx gulp --gulpfile build/gulpfile.ts watch
```

**ملاحظة**: الـ watch mode يحتاج Electron binary في `.build\electron\VSCodeEgypt.exe`. إذا لم يكن موجوداً:
```powershell
node node_modules/electron/install.js
mkdir -p .build\electron
cp node_modules\electron\dist\electron.exe .build\electron\VSCodeEgypt.exe
```

## 🔄 سير العمل للتعديلات

### الطريقة السريعة (Pre-built + Overlay):
1. عدّل الملفات في `vscode-egypt-dev/resources/app/`
2. أعد تشغيل `VS Code Egypt.exe`

### الطريقة الكاملة (Source Build):
1. عدّل سورس TypeScript في `D:\Dev\vscodium-source\vscode\src\`
2. شغّل `npx gulp watch` للتجميع التلقائي
3. التغييرات تظهر مباشرة

## 📝 الإصلاحات الخمسة — حالتها

| # | الإصلاح | الحالة | أين |
|---|---------|--------|-----|
| 1 | Restricted Mode | ✅ | `product.json: security.workspace.trust.*` |
| 2 | Titlebar Native/Custom | ✅ | `product.json: window.titleBarStyle: custom` |
| 3 | الثيم الليموني | ✅ | `extensions/vse-egypt-theme/` |
| 4 | AI Agent Sidebar | ✅ | `extensions/vse-egypt-ai/` |
| 5 | أيقونة كليوباترا | ✅ | `resources/win32/*.ico` |

## ⚠️ نقاط مهمة للتطوير المستقبلي

1. **ملفات JSON يجب أن تكون بدون BOM**: استخدم `[System.IO.File]::WriteAllText(path, content, [System.Text.UTF8Encoding]::new($false))` في PowerShell.

2. **صيغة `builtInExtensions`**: VS Code يشق اسم الإضافة بنقطة `.` — مثال: `vscode-egypt.vscode-egypt-theme` (وليس `publisher` + `name` منفصلين).

3. **الـ AI Agent الحالي بسيط**: لإضافة اتصال حقيقي بالباك إند DeepSeek،需 تعديل `extension.js` لإرسال HTTP requests.

4. **الـ patches في `patches/user/`**: هذه تطبق على سورس VSCodium وليست على التطبيق الجاهز.

5. **للبناء النهائي على GitHub Actions**: شغّل workflow `build-release.yml` بعد رفع Tag جديد.

## 🔑 Node 24 Portable

موجود في: `C:\Users\elhos\.node24\node-v24.11.1-win-x64\node.exe`

لتفعيله:
```powershell
$env:PATH = "C:\Users\elhos\.node24\node-v24.11.1-win-x64;" + $env:PATH
```
