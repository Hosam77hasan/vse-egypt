// config.js — the ONE file to edit before deploying vse-landing to GitHub Pages.
//
// GitHub Pages serves static files only — there is no server, no process.env,
// no way to read an environment variable at request time. This file is the
// static equivalent: plain values, loaded before script.js, that script.js
// reads instead of hitting a server-side redirect route.
//
// If you deploy via the included GitHub Actions workflow
// (.github/workflows/deploy-pages.yml), these two values are overwritten
// automatically from repo variables/secrets at build time — you don't need to
// hand-edit this file for that path. Edit it directly only for a manual deploy.
window.VSE_CONFIG = {
	// vse-payment-portal's public URL (Railway, or wherever it's hosted).
	paymentPortalUrl: 'http://localhost:4000',

	// vse-backend's public URL — not currently called directly by the landing
	// page (only the payment portal is), kept here so it's in one place if a
	// future landing-page feature needs it (e.g. a live download-count widget).
	backendUrl: 'http://localhost:8787',

	// Installer downloads. These deliberately do NOT point at files inside this
	// repo — GitHub Pages has a soft ~100MB per-file / ~1GB per-repo limit, not
	// meant for shipping .exe/.dmg binaries. Point these at a GitHub Release
	// instead (Releases support large binary assets properly, and `gh release
	// upload` is the standard way to publish what build-windows.ps1 /
	// build-macos.sh produce). Example once you've cut a release:
	//   https://github.com/<you>/vscode-egypt/releases/download/v1.0.0/vscode-egypt-setup.exe
	downloads: {
		windowsExe: 'https://github.com/REPLACE_ME/vscode-egypt/releases/latest/download/vscode-egypt-setup.exe',
		windowsMsi: 'https://github.com/REPLACE_ME/vscode-egypt/releases/latest/download/vscode-egypt-setup.msi',
		macArm64: 'https://github.com/REPLACE_ME/vscode-egypt/releases/latest/download/vscode-egypt-arm64.dmg',
		macX64: 'https://github.com/REPLACE_ME/vscode-egypt/releases/latest/download/vscode-egypt-x64.dmg',
	},
};
