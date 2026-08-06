# VS Code Egypt — Build Package (Session 4: Manual Payments + Hidden Admin PWA)

Continuation of the previous sessions. Same rules as before: everything here was
actually run — real servers booted with real HTTP requests against them,
real static-hosting simulation for the GitHub Pages piece. What's verified vs.
not is called out explicitly, not implied.

## New in this session

### 1. Manual payment queue (`vse-backend/services/payment/`, `routes/payment.js`)

Clean Architecture payment switcher: `routes/payment.js` depends only on
`services/payment/index.js`'s interface (`createRequest` / `listByStatus` /
`getById` / `approve` / `reject`), never on a concrete provider directly.
`ManualPaymentProvider.js` is the real, working implementation — a user submits
a claimed InstaPay/Vodafone Cash/PayPal/crypto transfer via
`POST /v1/payment/request`, nothing is credited until an admin approves it.
`AutomatedPaymentProvider.js` is a documented stub with the same interface, for
when a real gateway integration is ready — flip `PAYMENT_MODE=automated` and
implement it, no route/table changes needed. Defaults to `manual`.

New `payment_requests` table in `db/schema.sql`. Token conversion is rate-based
(`TOKENS_PER_EGP` / `TOKENS_PER_USD` env vars), unlike the fixed-tier ladder in
the existing `routes/topup.js` — a manual submission can be any amount.

**Verified end-to-end**: submitted a request (both same-origin and
cross-origin, confirming CORS headers and that a disallowed origin gets a clean
`403` not a `500`), listed it as pending, approved it, confirmed the token
wallet credited correctly, confirmed re-approving an already-reviewed request
correctly returns `409` rather than double-crediting.

### 2. Hidden admin PWA — passcode auth + Web Push (`middleware/adminAuth.js`, `services/push.js`)

**A real security decision made in this session, not just what was asked for
verbatim**: the original spec's passcode was a literal 7-digit number typed
directly into the task description. Hardcoding that into frontend JS would mean
anyone viewing GitHub Pages' page source gets it instantly, and a 7-digit
numeric code with no rate limiting is brute-forceable in minutes. Built instead:

- The passcode is never stored or compared as plaintext — `ADMIN_PASSCODE_HASH`
  is a bcrypt hash, generated via `scripts/hash-admin-passcode.js` (interactive
  prompt, avoids shell-history leakage).
- `POST /v1/payment/admin/login` issues a short-lived (8h) admin session JWT,
  signed with its own `ADMIN_JWT_SECRET` — a completely separate token family
  from customer login (`middleware/auth.js`). Every `/admin/*` route requires it.
- Two layers of brute-force defense: an in-memory `express-rate-limit` (10/15min,
  same numbers as the existing `authLimiter` in `server.js`) as the cheap first
  line, plus a persistent SQLite-backed lockout (`admin_login_attempts` table) —
  5 failures locks an IP out for 30 minutes, and unlike the in-memory limiter
  this survives a redeploy/restart.

`.env.example` ships with a *working* `ADMIN_PASSCODE_HASH` — a real bcrypt
hash of the original spec's passcode — purely so the server boots without extra
setup. **This is flagged explicitly in `.env.example`, `DEPLOYMENT.md`, and
here**: that exact passcode is not a secret anymore (it's in this chat
transcript and this spec), treat it as already compromised and rotate it with
the hash script before any real deployment.

`services/push.js` wraps `web-push` with VAPID keys, saves subscriptions to a
new `admin_push_subscriptions` table, and prunes subscriptions the push service
reports as gone (410/404). Fails soft — the whole admin panel works fine
without push configured, just without instant notifications.

**Verified**: correct/incorrect passcode, 5-failure lockout triggering `429`,
admin routes rejecting requests with no/invalid token (`403`), the
`vapid-public-key` and `subscribe-push` endpoints both gated correctly. **Not
verified**: an actual push notification delivered to a real browser — that
needs real VAPID keys and a live service worker, neither of which exist in this
sandbox (see the `vse-landing` section below for why).

### 3. Manual payment portal UI (`vse-payment-portal/public/manual-payment.html`)

New page, server-injected the same way `/dashboard/billing` already injects
`__VSE_BACKEND_URL__` — the real InstaPay handle / Vodafone Cash number /
PayPal email / crypto address come from env vars
(`INSTAPAY_HANDLE`, `VODAFONE_CASH_NUMBER`, `PAYPAL_EMAIL`,
`CRYPTO_USDT_TRC20_ADDRESS`), never hardcoded into the static bundle. A channel
left unset shows "not available" instead of a broken field.

**Verified**: booted with all four channels set, confirmed correct injection,
confirmed a submission from this origin reaches the backend successfully.

### 4. Hidden admin dashboard on `vse-landing` (GitHub Pages, zero Node)

`admin-trigger.js` — a 3-second long-press on the footer's copyright period
(`#stealthTrigger`) opens a passcode modal built entirely via DOM APIs (no
markup added to `index.html` beyond the trigger span itself). On success, the
admin session token goes into `sessionStorage` (not `localStorage` — cleared
when the tab closes) and redirects to `admin.html`.

`admin.html` / `admin.js` / `admin-style.css` — mobile-first pending/approved/
rejected request list with ✅/❌ actions, a deep-link anchor (`#request-N`) for
notification-click targeting, and an opt-in (never automatic) "enable
notifications" banner that registers `sw.js` and subscribes to push only after
the admin explicitly clicks it.

`sw.js` — handles `push` events (shows the notification even with the tab
closed) and `notificationclick` (focuses an existing admin tab or opens one, at
the specific request's anchor).

**Explicitly stated up front, in the file itself and in `DEPLOYMENT.md`**: the
long-press + passcode modal is UX obscurity, not the real security boundary —
GitHub Pages serves this file's source to anyone. The actual boundary is
server-side (section 2 above).

**Verified**: served `vse-landing/public/` with a plain Python `http.server`
(zero Node — the closest local simulation of GitHub Pages' actual hosting
model) and confirmed every new file serves with `200`, and that
`#stealthTrigger` is present in the rendered `index.html`. **Not verified**: an
actual long-press gesture in a real browser, service worker registration (which
requires HTTPS or `localhost` — this sandbox's Python server is plain HTTP on a
non-localhost-equivalent setup for that API's purposes), or a live push
round-trip. These need a real browser and real HTTPS hosting to test for real —
try the full flow once on the actual GitHub Pages deployment before relying on
the notification path for anything time-sensitive.

## What's still open

- `AutomatedPaymentProvider.js` is a stub — implementing it against a real
  gateway (and deciding whether the manual queue stays as a fallback) is future
  work, not done here.
- The service worker / push flow needs a first real test against actual GitHub
  Pages HTTPS hosting and a real phone/browser — everything server-side and
  static-file-serving is verified, the live push delivery is not.
- No PWA `manifest.json` was added (installability/add-to-homescreen) — the
  spec asked for `sw.js` + Push Manager specifically, not full installability,
  and there are no icon assets in this repo to point a manifest at yet.
