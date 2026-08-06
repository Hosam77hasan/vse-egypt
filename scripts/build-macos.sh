#!/bin/bash
# build-macos.sh — VS Code Egypt macOS packaging
#
# Run from the vscode-egypt/vscode directory (the actual VS Code source checkout,
# with all patches/user/*.patch already applied — see the main README).
#
# ============================== NOT RUN IN THIS SESSION ==============================
# Written and reviewed for correctness against VSCodium's real build scripts and
# gulp task names, but NOT executed — this sandbox is Linux, has no macOS toolchain,
# no Apple Developer certificate, and no notarization credentials. Run this on an
# actual Mac (or macOS CI runner) with the prerequisites below.
# ==========================================================================================

set -euo pipefail

echo "== VS Code Egypt — macOS build =="

for cmd in node yarn python3; do
    command -v "$cmd" >/dev/null 2>&1 || { echo "ERROR: $cmd not found on PATH."; exit 1; }
done

echo "-- Compiling..."
yarn gulp compile-build

build_arch() {
    local arch=$1       # x64 | arm64
    local gulp_task=$2  # vscode-darwin-x64 | vscode-darwin-arm64
    local out_dir="../VSCode-darwin-${arch}"

    echo "-- Packaging darwin-${arch}..."
    yarn gulp "$gulp_task"

    if [ ! -d "$out_dir" ]; then
        echo "ERROR: expected output at $out_dir but it doesn't exist. Check the gulp task output above for the real path — it can shift between VS Code source versions."
        exit 1
    fi

    local app_path="${out_dir}/VS Code Egypt.app"

    # --- Code signing (REQUIRES A REAL APPLE DEVELOPER ID CERTIFICATE) ---
    # Without this, macOS Gatekeeper will refuse to open the app at all (not just
    # warn) — this is a hard requirement for distribution, not optional polish.
    if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
        echo "-- Signing ${arch} binary..."
        # --deep is generally discouraged for production signing (it can mask
        # signing issues in nested binaries); a real pipeline should sign
        # frameworks/helpers explicitly, inside-out, before the outer .app.
        # Simplified here to the single top-level call for clarity.
        codesign --force --options runtime --deep \
            --sign "$APPLE_SIGNING_IDENTITY" \
            --entitlements "../resources/darwin/vscode-egypt.entitlements" \
            "$app_path"
    else
        echo "WARNING: APPLE_SIGNING_IDENTITY not set — producing an UNSIGNED build. Gatekeeper will block this app entirely on other users' Macs."
    fi

    # --- Notarization (REQUIRES A REAL APPLE DEVELOPER ACCOUNT) ---
    if [ -n "${APPLE_NOTARIZATION_APPLE_ID:-}" ] && [ -n "${APPLE_NOTARIZATION_PASSWORD:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ]; then
        echo "-- Notarizing ${arch} build (this can take several minutes)..."
        local zip_path="/tmp/vscode-egypt-${arch}-notarize.zip"
        ditto -c -k --keepParent "$app_path" "$zip_path"
        xcrun notarytool submit "$zip_path" \
            --apple-id "$APPLE_NOTARIZATION_APPLE_ID" \
            --password "$APPLE_NOTARIZATION_PASSWORD" \
            --team-id "$APPLE_TEAM_ID" \
            --wait
        xcrun stapler staple "$app_path"
    else
        echo "WARNING: notarization credentials not set — skipping. An unnotarized app will show an 'unidentified developer' warning even if signed."
    fi

    # --- Build the .dmg ---
    echo "-- Building .dmg for ${arch}..."
    mkdir -p dist
    local dmg_name="vscode-egypt-${arch}.dmg"
    # create-dmg (https://github.com/create-dmg/create-dmg) gives a proper
    # drag-to-Applications installer background/layout — this is what VSCodium's
    # own darwin packaging actually uses under build/darwin/, not a bare hdiutil call.
    if command -v create-dmg >/dev/null 2>&1; then
        create-dmg \
            --volname "VS Code Egypt" \
            --window-size 600 400 \
            --icon-size 100 \
            --app-drop-link 450 200 \
            "dist/${dmg_name}" \
            "$app_path"
    else
        echo "create-dmg not found (npm install -g create-dmg, or brew install create-dmg) — falling back to a plain hdiutil image with no custom layout."
        hdiutil create -volname "VS Code Egypt" -srcfolder "$app_path" -ov -format UDZO "dist/${dmg_name}"
    fi

    echo "-- Done: dist/${dmg_name}"
}

build_arch "arm64" "vscode-darwin-arm64"
build_arch "x64" "vscode-darwin-x64"

echo "== All macOS builds complete. See ./dist/ =="
