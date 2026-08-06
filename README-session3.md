# VS Code Egypt — Build Package (Session 3: Auth, Billing, Landing)

Continuation of the previous build package. Same rules as before: everything here
was actually run — real patches against a live clone of `microsoft/vscode`, real
`tsc` compiles catching real bugs, real servers booted with real HTTP requests
against them. What's verified vs. not is called out explicitly, not implied.

## New in this session

### 1. Full auth system (`vse-backend/routes/auth.js`, `services/email.js`)

Signup, email OTP verification, resend, login, refresh-token rotation, `/me`.
**Verified end-to-end, 11/11 checks passed**, including: OTP dev-mode logging
(no real SMTP needed to develop), wrong-code rejection, OTP-reuse blocked,
login blocked before verification, refresh token rotation (old token rejected
after use), wrong password rejected.

Set real `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` in `.env` before production — with
none set, the server runs in dev mode and just logs OTP emails to the console
instead of sending them. That's intentional for local development, not a bug.

### 2. Unified plan gating — a real integration bug, caught and fixed

The previous session's `/v1/chat` auth middleware only recognized payment-portal
license tokens (`{ jti, sub, plan }`). This session's new account access tokens
have a different shape (`{ sub, plan, type: 'access' }`). Without a fix, a
signed-in user's own access token would have been silently rejected by the AI
chat endpoint. `middleware/auth.js` now accepts both shapes — access tokens are
checked live against the `users` table's current plan (not the token's `plan`
claim, which can go stale within its 15-minute lifetime), and legacy license
tokens still work for gift/offline-code flows. **Verified**: signed up a user,
hit `/v1/chat` on the free plan (correctly blocked, 429), upgraded the plan
directly in the DB, hit `/v1/chat` again with the *same, unrefreshed* access
token (correctly passed the gate and attempted the real DeepSeek call).

### 3. Embedded login/signup modal (`patches/user/onboarding-gate.patch`)

A `WorkbenchPhase.BlockStartup` contribution shows a webview-based modal
overlay on first run if there's no valid session, with a full login/signup/OTP
flow talking to the routes above. Once authenticated, a free-plan account sees
a non-blocking upsell dialog pointing at the billing dashboard — it does not
prevent using the editor without AI.

**Three real bugs caught by actually compiling this against real VS Code
TypeScript** (not just written and assumed correct):
- `webview.claim()` doesn't exist on `IWebviewElement` (that method belongs to
  a *different* interface, `IOverlayWebview`, from a different factory
  method). I'd called it in both this modal and the chat panel. Removed both.
- `layoutWebviewOverElement()` — an invented method name that doesn't exist
  anywhere in the codebase. Removed; `mountTo()`-based webviews size via
  ordinary CSS, no explicit layout call needed.
- Several `noImplicitAny` violations on callback parameters, fixed with the
  actual imported types.

### 4. Sidebar AI chat panel (`patches/user/chat-panel.patch`)

Native webview-based chat panel in the sidebar (same slot the Extensions
viewlet used to occupy), with a persisted per-workspace chat history and a
streaming connection to `/v1/chat`. Includes an "Upgrade / Billing" link in
its header, wired to the same command the status bar button uses.

### 5. Status bar plan indicator (`patches/user/statusbar-billing-entry.patch`)

Shows "Sign In" / "Upgrade" / "Pro" / "Team" depending on stored account
state, right-aligned in the status bar. Clicking it opens the web billing
dashboard via a registered command (`vscodeEgypt.openBillingDashboard`),
shared by both the status bar and the chat panel's upgrade link — not
duplicated logic.

### 6. `vse-landing/` — marketing site

Dark/lime brand (matching the IDE theme), Space Mono + Inter type pairing, a
live animated code-editor mockup in the hero (typing animation → Ctrl+K popup
materializes) as the page's signature element rather than a generic
gradient-hero template. Smart OS-detecting download button, feature grid,
monthly/yearly + EGP/USD pricing toggle, and a thin Express wrapper
(`server.js`) that forwards pricing CTAs into `vse-payment-portal` with the
plan pre-selected.

**A second real gap caught while wiring this up**: the landing page's Team
plan yearly toggle referenced a `team_yearly` SKU that the payment portal's
`PLAN_CATALOG` never defined. Added it server-side, and taught the portal's
frontend to read `?sku=` from the URL and skip straight to the payment-method
step instead of making the user re-pick a plan they already chose on the
landing page.

**Verified end-to-end**: booted all three servers (backend, payment portal,
landing) together, confirmed `/checkout?sku=pro_yearly` redirects to the exact
right portal URL, and ran full checkout for both a pre-existing SKU
(`pro_yearly`) and the newly-added one (`team_yearly`) — both issued real,
valid licenses. Zero server errors across any of it.

## Apply instructions (additive to the previous README)

```powershell
cd C:\Dev\vscode-egypt\vscode
git apply --check ..\patches\user\onboarding-gate.patch
git apply ..\patches\user\onboarding-gate.patch
git apply --check ..\patches\user\chat-panel.patch
git apply ..\patches\user\chat-panel.patch
git apply --check ..\patches\user\statusbar-billing-entry.patch
git apply ..\patches\user\statusbar-billing-entry.patch
git apply --check ..\patches\user\workbench-manifest-registrations.patch
git apply ..\patches\user\workbench-manifest-registrations.patch
```

Apply in this order — `workbench-manifest-registrations.patch` touches the
same file (`workbench.common.main.ts`) that earlier patches already modified
for the license gate registration, so it must go last, after the files it
imports already exist on disk.

```powershell
cd C:\Dev\vse-backend
copy .env.example .env
notepad .env   REM fill in DEEPSEEK_API_KEY, LICENSE_JWT_SECRET, PAYMENT_PORTAL_INTERNAL_SECRET, and SMTP_* for real email
npm install
npm start
```

```powershell
cd C:\Dev\vse-landing
echo PAYMENT_PORTAL_URL=http://localhost:4000> .env
echo LANDING_PORT=5000>> .env
npm install
npm start
```

## Still not built

- The Ctrl+K inline-editing controller inside the text editor itself — this
  remains the one item from the original spec not yet started. It's core
  `ICodeEditor`/`EditorContribution` work, the largest single remaining piece.
- Real SMTP provider integration (currently dev-mode console logging).
- Real Vodafone Cash / Meeza merchant API integration (still explicitly
  simulated, as documented in the payment portal's own code comments).
- The `.exe`/`.msi`/`.dmg` build artifacts referenced by the landing page's
  download links don't exist yet — those come from the Windows/macOS
  packaging step covered in outline earlier in this conversation, not
  re-verified in this session.
