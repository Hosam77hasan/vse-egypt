# Changelog

All notable changes to VS Code Egypt will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-08-10

### 🎨 Branding & Theme

#### Fixed
- **Theme now loads on first launch** — Added `builtInExtensions` entry in `product.json` to ensure the VS Code Egypt Lime theme extension is recognized as a built-in extension
- **ConfigurationDefaults properly injected** — The `workbench.colorTheme` setting is now set via `configurationDefaults` in `product.json`, ensuring the Lime theme activates automatically on first launch without user intervention

#### Changed
- Theme extension is now copied to `resources/app/extensions/vscode-egypt-theme/` during the build process
- Added verification step in E2E tests to confirm theme extension is bundled correctly

---

### 🖼️ Icons & Shortcuts

#### Fixed
- **Desktop shortcut icon** — The `kliopatra.ico` file is now explicitly bundled and referenced in the Inno Setup script, ensuring shortcuts display the correct Kliopatra icon instead of the default Notepad/VSCodium icon
- **Taskbar & Start Menu icons** — The `SetupIconFile` directive in the Inno Setup script now correctly references `kliopatra.ico`, ensuring the installer, desktop shortcut, and Start Menu shortcut all show the Kliopatra icon
- **rcedit icon replacement** — Added `continue-on-error: true` to the rcedit step so the build doesn't fail if icon replacement has issues; shortcuts still use `kliopatra.ico` as fallback
- **Shortcut creation robustness** — Updated `fix-shortcut.ps1` to verify the target EXE and icon file exist before creating the shortcut, with fallback logic to find them in alternative locations

#### Changed
- Inno Setup script now explicitly copies `kliopatra.ico` to `{app}` directory
- Standalone `scripts/build-windows.iss` updated to use `{#AppPath}` for icon path instead of relative paths

---

### 🔒 Security & Trust

#### Fixed
- **Workspace Trust completely disabled** — Added comprehensive `configurationDefaults` that disable all Workspace Trust prompts:
  - `security.workspace.trust.enabled`: false
  - `security.workspace.trust.startupPrompt`: "never"
  - `security.workspace.trust.banner`: "never"
  - `security.workspace.trust.emptyWindow`: false
- **No more security warnings** — All trust-related dialogs and banners are suppressed on first launch

#### Changed
- Trust settings are now injected via `product.json` `configurationDefaults` rather than relying on user settings files

---

### 🤖 AI Extension Filtering

#### Fixed
- **Competing AI extensions blocked** — The `extensionAiBlocklist` in `product.json` now includes all major competing AI extensions:
  - GitHub Copilot family
  - Tabnine
  - Codeium/Windsurf
  - Amazon Q
  - Continue/Cody
  - Gemini
  - Claude/Anthropic
  - Cursor
  - And 30+ more AI-related extensions
- **AI keyword blocking** — Added `extensionAiBlockedKeywords` to block extensions with AI-related terms in their name, description, or keywords
- **Built-in AI suggestions disabled** — Added settings to disable Copilot and inline suggestions:
  - `chat.enabled`: false
  - `github.copilot.enable`: {}
  - `editor.inlineSuggest.enabled`: false

#### Added
- **Unit tests for AI extension filter** — Created 54 comprehensive tests covering:
  - Blocked extension IDs (GitHub Copilot, Tabnine, Codeium, Claude, Cursor, etc.)
  - AI keyword detection in name, description, categories, keywords, and publisher
  - Category-based blocking (Machine Learning, AI, LLM, etc.)
  - Allowed extensions (themes, formatters, linters, language support, etc.)
  - Edge cases and consistency checks
- Test file location: `vse-extension/editor/src/browser/__tests__/extensionAiFilter.test.js`
- Tests also available at: `vse-backend/tests/unit/extensionAiFilter.test.js`

---

### 📦 Build Pipeline

#### Fixed
- **macOS build step** — Rewrote the `apply branding` step to use pure Python instead of PowerShell syntax (`Get-Content`, `$()`) which was causing the macOS build to fail
- **Theme extension loading** — Build process now explicitly copies the theme extension to the built-in extensions directory
- **AI extension loading** — Build process now copies the AI extension to the built-in extensions directory
- **Product.json injection** — Both Windows and macOS builds now inject `configurationDefaults`, `builtInExtensions`, and branding into `product.json`

#### Added
- **E2E test: Theme verification** — New test step verifies the theme extension is bundled at `resources/app/extensions/vscode-egypt-theme/`
- **E2E test: Product.json verification** — New test step verifies `configurationDefaults` and `builtInExtensions` are present in the installed product.json
- **E2E test: Icon verification** — Enhanced shortcut verification to check that `kliopatra.ico` is referenced

#### Changed
- `build-windows.ps1` now includes `configurationDefaults` injection for local builds
- Inno Setup script generation in workflow now includes explicit icon file references

---

### 📝 Documentation

#### Added
- This changelog file (`CHANGELOG.md`)
- Inline comments in build scripts explaining the purpose of each step

---

## [1.0.0] - 2026-08-01

### Initial Release
- VS Code Egypt fork based on VSCodium
- Custom Lime/Black theme
- AI Chat panel with 3 models (Driver, Leader, Innovator)
- Ctrl+K inline editing
- Agent Mode for multi-file planning
- License/subscription gate
- Windows installer (.exe and .msi)
- macOS DMG
- AI extension filtering
- Workspace indexing and RAG context

---

## Upgrade Notes

### From 1.0.x to 1.1.0

1. **Theme**: The Lime theme will now load automatically on first launch. If you had manually set a different theme, it will be overwritten by the default.

2. **Extensions**: Some AI extensions (Copilot, Tabnine, Codeium, etc.) will be blocked from installation. This is by design — VS Code Egypt includes built-in AI models (Driver, Leader, Innovator) that provide similar functionality.

3. **Trust Dialogs**: Workspace Trust dialogs will no longer appear. This is intentional for a smoother user experience.

4. **Icons**: Desktop and Start Menu shortcuts will now show the Kliopatra icon instead of the default VSCodium icon.

---

*Built with ❤️ by Emperor Software Development*
