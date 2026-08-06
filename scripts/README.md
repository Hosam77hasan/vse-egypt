# Packaging & Setup Scripts

`install-vscode-egypt.ps1` — automates the full setup from a fresh Windows machine: prerequisites, VSCodium source, all patches, branding, and all three Node services. Verified with a real PowerShell 7 parser (zero syntax errors) and the reusable functions were unit-tested in isolation, but the full script has NOT been run end-to-end on a real Windows machine (this environment is Linux) — see the detailed PDF walkthrough for what to watch for.
`run-all.ps1` — starts the backend, payment portal, and landing site together after installation, each in its own window.
`build-windows.ps1` + `build-windows.iss` — Windows `.exe` installer via Inno Setup.
`build-macos.sh` + `vscode-egypt.entitlements` — macOS `.dmg` for both `arm64` and `x64`, with code-signing and notarization steps.

## Before running these

**None of these scripts have been executed** — this build environment is a Linux
sandbox with no Windows or macOS toolchain, no Inno Setup, no Apple Developer
account, and no code-signing certificates of any kind. They were written and
reviewed for correctness against VSCodium's actual gulp task names and build
architecture (the same one this whole project is built on), but "written
correctly" and "proven to work" are different claims — run them for real on
the appropriate OS before trusting them blindly.

## Windows

1. Copy `build-windows.ps1` and `build-windows.iss` into your `vscode-egypt/vscode/` checkout.
2. Install [Inno Setup 6](https://jrsoftware.org/isinfo.php).
3. Get a code-signing certificate from a CA (DigiCert, Sectigo, etc.) — without
   one, the script still produces an installer, but Windows SmartScreen will
   flag it as an unknown publisher. This is not something that can be worked
   around without a real certificate.
4. Run: `powershell -File build-windows.ps1`

## macOS

1. Copy `build-macos.sh` into your `vscode-egypt/vscode/` checkout, and
   `vscode-egypt.entitlements` into `vscode-egypt/resources/darwin/`.
2. `chmod +x build-macos.sh`
3. Requires an Apple Developer Program account for signing
   (`APPLE_SIGNING_IDENTITY`) and notarization
   (`APPLE_NOTARIZATION_APPLE_ID`, `APPLE_NOTARIZATION_PASSWORD`,
   `APPLE_TEAM_ID`) — without these, the script still runs and produces a
   `.dmg`, but macOS Gatekeeper will refuse to open the unsigned app entirely
   on any Mac other than the one that built it.
4. Optional but recommended: `npm install -g create-dmg` for a proper
   drag-to-Applications installer layout instead of a bare disk image.
5. Run: `./build-macos.sh`

## What "done" actually requires

Getting real, distributable `.exe`/`.dmg` files that don't trigger OS security
warnings needs, at minimum:
- A registered Apple Developer Program membership ($99/year) for macOS signing + notarization
- A code-signing certificate for Windows (varies by CA, typically $100–400/year)
- Running these scripts on the actual target OS (a Linux CI runner cannot produce a signed macOS or Windows build)

None of that can be substituted or faked from this environment.
