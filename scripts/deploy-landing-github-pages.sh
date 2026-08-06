#!/bin/bash
# deploy-landing-github-pages.sh
#
# Simple manual alternative to .github/workflows/deploy-pages.yml — pushes
# vse-landing/public/ to a gh-pages branch by hand. Use this if you're not
# using GitHub Actions, or want to deploy a one-off change immediately.
#
# Usage:
#   PAYMENT_PORTAL_URL=https://your-portal.up.railway.app \
#   BACKEND_URL=https://your-backend.up.railway.app \
#   DOWNLOAD_BASE_URL=https://github.com/you/vscode-egypt/releases/latest/download \
#   ./deploy-landing-github-pages.sh

set -euo pipefail

if [ -z "${PAYMENT_PORTAL_URL:-}" ]; then
    echo "ERROR: set PAYMENT_PORTAL_URL first, e.g.:"
    echo "  PAYMENT_PORTAL_URL=https://your-portal.up.railway.app ./deploy-landing-github-pages.sh"
    exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LANDING_DIR="$REPO_ROOT/vse-landing/public"
BUILD_DIR="$(mktemp -d)"

echo "== Copying vse-landing/public into a clean build directory =="
cp -r "$LANDING_DIR"/* "$BUILD_DIR/"

echo "== Injecting production config =="
CONFIG_FILE="$BUILD_DIR/config.js"
sed -i.bak "s#paymentPortalUrl: '[^']*'#paymentPortalUrl: '${PAYMENT_PORTAL_URL}'#" "$CONFIG_FILE"
if [ -n "${BACKEND_URL:-}" ]; then
    sed -i.bak "s#backendUrl: '[^']*'#backendUrl: '${BACKEND_URL}'#" "$CONFIG_FILE"
fi
if [ -n "${DOWNLOAD_BASE_URL:-}" ]; then
    sed -i.bak "s#windowsExe: '[^']*'#windowsExe: '${DOWNLOAD_BASE_URL}/vscode-egypt-setup.exe'#" "$CONFIG_FILE"
    sed -i.bak "s#windowsMsi: '[^']*'#windowsMsi: '${DOWNLOAD_BASE_URL}/vscode-egypt-setup.msi'#" "$CONFIG_FILE"
    sed -i.bak "s#macArm64: '[^']*'#macArm64: '${DOWNLOAD_BASE_URL}/vscode-egypt-arm64.dmg'#" "$CONFIG_FILE"
    sed -i.bak "s#macX64: '[^']*'#macX64: '${DOWNLOAD_BASE_URL}/vscode-egypt-x64.dmg'#" "$CONFIG_FILE"
fi
rm -f "$CONFIG_FILE.bak"

echo "-- resulting config.js --"
cat "$CONFIG_FILE"
echo ""

echo "== Pushing to gh-pages branch =="
cd "$BUILD_DIR"
git init -q
git add -A
git commit -q -m "Deploy vse-landing $(date -u +%Y-%m-%dT%H:%M:%SZ)"

REMOTE_URL="$(cd "$REPO_ROOT" && git config --get remote.origin.url || true)"
if [ -z "$REMOTE_URL" ]; then
    echo "ERROR: no git remote 'origin' found in $REPO_ROOT — this script pushes to that repo's gh-pages branch, so it needs to already be a git repo with a remote configured."
    exit 1
fi

git remote add origin "$REMOTE_URL"
git push --force origin HEAD:gh-pages

echo ""
echo "== Done. Enable GitHub Pages for this repo (Settings > Pages > Branch: gh-pages) if you haven't already. =="
rm -rf "$BUILD_DIR"
