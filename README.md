# VS Code Egypt — Build Package

Everything here was built and tested in a sandboxed Linux container against the
real `microsoft/vscode` source (cloned live from GitHub) and a real Node.js
runtime — not hand-typed guesses. What passed and what didn't is called out
below. This was NOT applied to your actual repo at `C:\Dev\vscode-egypt` —
I have no access to your machine. You apply these yourself with the commands
below.

## 1. Branding — `product.json`

Copy `product.json` over the root `product.json` in your `vscode-egypt` clone
(the VSCodium orchestration repo root, not `vscode/product.json` — that one
gets merged automatically by `prepare_vscode.sh`).

```powershell
copy product.json C:\Dev\vscode-egypt\product.json
```

## 2. Theme — Lime & Black

Copy the whole theme extension folder into `vscode/extensions/` (built-in,
not Marketplace — ships in the binary like VS Code's own default themes):

```powershell
xcopy /E /I extensions\vscode-egypt-theme C:\Dev\vscode-egypt\vscode\extensions\vscode-egypt-theme
```

Verified: both `package.json` and the theme JSON are valid JSON
(`python3 -m json.tool` clean). Not yet visually verified in a running
Electron shell — do that after your next `yarn watch` + `code.bat` test.

## 3. Extensions Viewlet removal — patches

Two patches, apply from inside `vscode/`:

```powershell
cd C:\Dev\vscode-egypt\vscode
git apply --check ..\patches\user\hide-extensions-viewlet.patch   # dry run first
git apply ..\patches\user\hide-extensions-viewlet.patch
git apply --check ..\patches\user\license-gate-contribution.patch
git apply ..\patches\user\license-gate-contribution.patch
```

**What these actually do** (verified against real current source, line-level):
- Filters the Extensions viewlet out of `viewDescriptorService.ts`'s
  `getViewContainersByLocation()` — the single function that feeds the
  Activity Bar AND the "Open View" quick pick. This hides the icon everywhere
  without deleting the ~40 other files across the codebase that still import
  `VIEWLET_ID`/`VIEW_CONTAINER` for internal API compatibility — deleting the
  whole registration would cascade into compile errors across those files.
- Strips `openCommandActionDescriptor` from the viewlet registration, which
  removes the Command Palette entry, the View menu item, and the
  `Ctrl+Shift+X` keybinding in one place.
- Removes the now-unused `KeyMod`/`KeyCode` import that edit orphaned — VS
  Code's build runs with `noUnusedLocals: true`, so leaving it in would fail
  compilation. I caught this by grepping the file, not by assumption.
- Adds a new `licenseGate.contribution.ts` registered at
  `WorkbenchPhase.BlockStartup` (a real, documented VS Code contribution
  phase that blocks workbench startup until the returned promise resolves).
  I used this instead of patching `Workbench.startup()` directly — that
  method is synchronous and load-bearing for the Electron bootstrap chain,
  and forcing it async is a much riskier change than using the extension
  point VS Code already provides for exactly this purpose.

**Not verified**: I could not run the actual TypeScript compiler or
`yarn watch` against these patches (no full VS Code build toolchain in this
sandbox — that's a 15–40 minute `yarn install` plus native module compilation
you already did in your own environment). Run `yarn watch` after applying and
watch for TS errors before trusting this fully. If a future upstream sync
shifts these files, `git apply --check` will tell you cleanly rather than
silently corrupting anything.

## 4. Backend — `vse-backend/`

```powershell
xcopy /E /I vse-backend C:\Dev\vse-backend
cd C:\Dev\vse-backend
copy .env.example .env
notepad .env   REM fill in your real DEEPSEEK_API_KEY, LICENSE_JWT_SECRET, PAYMENT_PORTAL_INTERNAL_SECRET
npm install
npm start
```

**Verified for real, in this sandbox** (see the actual curl output above in
conversation — not asserted, run):
- Server boots clean, `/healthz` responds.
- `/v1/license/verify` correctly rejects garbage tokens.
- `/v1/license/issue` correctly returns 403 without the internal secret header.
- **Found and fixed a real bug during testing**: if `PAYMENT_PORTAL_INTERNAL_SECRET`
  were ever unset, the original code's `undefined !== undefined` check would
  evaluate `false` and silently open the issue endpoint. Fixed by failing
  closed at startup if the secret isn't configured — this is already in the
  code you're getting, not a TODO.
- A freshly issued license round-trips correctly through `/v1/license/verify`
  (`valid:true`).
- `/v1/chat` correctly returns 401 with no auth header, and correctly attempts
  (and cleanly reports failure on, given a fake key) the real DeepSeek
  streaming call — the failure in my test was my sandbox's network allowlist
  blocking `api.deepseek.com`, not a code bug; you'll get real responses in
  your environment once `DEEPSEEK_API_KEY` is real.

**Not verified**: I did not test against a real DeepSeek API key or a real
multi-user load pattern. `better-sqlite3` is fine for early-stage single-node
deployment; swap for Postgres before you have concurrent-write contention at
scale (the schema translates directly).

## 5. Payment portal — `vse-payment-portal/`

```powershell
xcopy /E /I vse-payment-portal C:\Dev\vse-payment-portal
cd C:\Dev\vse-payment-portal
copy ..\vse-backend\.env .env
echo VSE_BACKEND_URL=http://localhost:8787>> .env
echo PAYMENT_PORTAL_PORT=4000>> .env
npm install
npm start
```

**Verified for real**: full checkout → license issuance round-trip works
end-to-end against the real running backend (both Vodafone Cash and Meeza
mock paths), invalid phone number is correctly rejected, static assets serve.

**This is explicitly a simulation, clearly marked in the code** — it does
NOT integrate real Vodafone Cash or Meeza merchant APIs (those require
signed merchant agreements and credentials I don't have and can't fabricate).
`simulateGatewayConfirmation()` in `server/index.js` is the exact function to
replace once you have real merchant credentials. Also flagged in code: the
portal currently trusts a `?uid=` query param for the user id, which is a
placeholder — wire this to your real portal login/session before going live,
or anyone could mint a license for any user id.

## What I have NOT built yet

- The Ctrl+K inline-editing controller and sidebar chat panel UI (item 3 in
  your original spec) — that's core editor/TextModel integration, larger in
  scope than what fit in this pass. Say the word and I'll do the same
  clone-verify-patch process for it.
- Windows/macOS packaging (`.exe`/`.dmg`) build commands — covered in outline
  in our earlier turns, not re-verified here.
