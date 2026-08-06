# Deploying VS Code Egypt to Production

Target architecture: `vse-backend` and `vse-payment-portal` on Railway (both need a
real Node process — Railway, not GitHub Pages), `vse-landing` on GitHub Pages (pure
static, no server needed). Everything below was built and tested in this session;
what's actually verified vs. what's real-but-unverified-against-a-live-Railway-account
is called out explicitly, same as every other part of this project.

## 1. `vse-backend` on Railway

### 1.1 Persistent database (Railway Volume)

SQLite lives on disk — without a persistent volume, every Railway redeploy wipes
the database. Set this up first:

1. In your Railway project, add a **Volume** to the `vse-backend` service, mounted
   at `/data`.
2. Set the environment variable:
   ```
   DATABASE_PATH=/data/vse.sqlite
   ```

**Verified in this session**: `db/index.js` now reads `DATABASE_PATH` (falling back
to `SQLITE_DB_PATH`, then a local default), and creates the parent directory if it
doesn't exist yet. Tested directly — pointed `DATABASE_PATH` at a fresh, nonexistent
directory (`/tmp/railway-volume-test/vse.sqlite`), confirmed the directory and
database file were both created correctly, and the server answered `/healthz` on a
custom port at the same time. Not tested against a real Railway Volume specifically
(that requires an actual Railway account/project) — but the underlying filesystem
behavior it depends on (`fs.mkdirSync` + `better-sqlite3` opening a path) is
platform-generic and doesn't care whether the directory is a Railway volume mount
or a local temp directory.

### 1.2 Port

Already handled — `server.js` reads `process.env.PORT`, which Railway injects
automatically. No action needed. (The `|| 8787` fallback only applies when running
locally without Railway.)

### 1.3 CORS

Set:
```
CORS_ORIGIN=https://<your-github-username>.github.io,https://<your-portal>.up.railway.app
```
Comma-separated, no spaces needed (they're trimmed). `localhost:3000/4000/5000` are
already allowed by default for local dev, no need to list them.

**Verified**: tested both an allowed origin (correct `Access-Control-Allow-Origin`
header) and a disallowed one. Found and fixed a real bug in the process — a
disallowed origin was returning a generic `500` and getting logged as if it were a
server crash; now returns a clean `403` with no log spam.

### 1.4 All other environment variables

Copy `vse-backend/.env.example` into Railway's environment variable settings and
fill in the real values — `DEEPSEEK_API_KEY`, `LICENSE_JWT_SECRET`,
`PAYMENT_PORTAL_INTERNAL_SECRET`, SMTP credentials, etc. Same variables as local
dev, same file, just entered into Railway's dashboard instead of a `.env` file.

### 1.5 Railway config file

`vse-backend/railway.json` is included — sets the start command, a `/healthz`
healthcheck, and an on-failure restart policy. Railway's Nixpacks builder
auto-detects this is a Node project from `package.json`, no Dockerfile needed.

### 1.6 Manual payment queue + hidden admin PWA

New in this session: `routes/payment.js`, `services/payment/`, `services/push.js`,
`middleware/adminAuth.js`. Env vars are documented inline in `.env.example`
(`PAYMENT_MODE`, `ADMIN_JWT_SECRET`, `ADMIN_PASSCODE_HASH`, `ADMIN_LOGIN_MAX_ATTEMPTS`,
`ADMIN_LOGIN_LOCKOUT_MINUTES`, `TOKENS_PER_EGP`, `TOKENS_PER_USD`, `VAPID_*`) — same
"copy `.env.example` into Railway" process as 1.4 above.

**Before going live**: `.env.example` ships a working `ADMIN_PASSCODE_HASH` (a
bcrypt hash of a placeholder passcode that appeared in this project's original
spec) purely so the server boots out of the box. Treat that passcode as already
compromised — run `node scripts/hash-admin-passcode.js` and replace the line
with a hash of a passcode only you know before deploying anywhere real.

**Verified in this session**: booted the backend with test env vars and exercised
the full flow end-to-end over HTTP — submitted a manual request (including
cross-origin from a simulated `vse-payment-portal` origin, confirming CORS +
`Access-Control-Allow-Origin` behave correctly and a disallowed origin gets a
clean `403` rather than a `500`), logged into `/v1/payment/admin/login` with the
correct and incorrect passcode, confirmed 5 failed attempts trigger the
persistent lockout (`429`), listed pending requests with and without the admin
session token (`200` vs `403`), approved a request and confirmed re-approving an
already-reviewed one correctly returns `409`, and hit `/v1/payment/admin/vapid-public-key`
and `/v1/payment/admin/subscribe-push` both with and without auth. Web Push
delivery itself (an actual push to a real browser subscription) was **not**
tested — that requires real VAPID keys and a live browser/service-worker,
neither of which exist in this sandbox. The `services/push.js` wrapper around
`web-push` is a thin, standard integration, but treat the push-delivery path as
unverified against a real device until you've tried it once.

## 2. `vse-payment-portal` on Railway

Same process as the backend — a second Railway service, its own Volume is **not**
needed (it has no database of its own, it only calls `vse-backend`). Environment
variables needed:
```
VSE_BACKEND_URL=https://<your-backend>.up.railway.app
PAYMENT_PORTAL_INTERNAL_SECRET=<same value as vse-backend's>
```
Port handling matches the backend now: `server/index.js` reads `process.env.PORT`
first (which Railway injects automatically), falling back to
`PAYMENT_PORTAL_PORT` for local dev, then `4000`. **Verified**: tested both env
var paths directly — `PORT=9222` and, separately, `PAYMENT_PORTAL_PORT=9333` with
`PORT` unset — both correctly bound the server to the expected port.

### 2.1 Manual payment channels

New `/manual-payment` route (`vse-payment-portal/public/manual-payment.html` +
`.js`) — the user-facing form for InstaPay / Vodafone Cash / PayPal / crypto
top-ups. The actual handle/number/address for each channel comes from env vars,
injected server-side the same way `VSE_BACKEND_URL` already is for
`/dashboard/billing`, so nothing is hardcoded into the static bundle:
```
INSTAPAY_HANDLE=yourhandle@instapay
VODAFONE_CASH_NUMBER=01xxxxxxxxx
PAYPAL_EMAIL=you@example.com
CRYPTO_USDT_TRC20_ADDRESS=T...
```
Any channel left unset shows as "not available" on the page rather than a broken
field. **Verified**: booted the server with all four set and confirmed
`/manual-payment` injects the correct values, and confirmed a submission from
this origin reaches `vse-backend`'s `/v1/payment/request` successfully (see 1.6).

## 3. `vse-landing` on GitHub Pages

### 3.1 Why this needed real changes, not just a copy-paste

GitHub Pages serves static files only — no Node process, no `server.js`, no
`process.env`. The landing site previously depended on its own Express server for
two things: redirecting `/checkout` and `/support` to the payment portal. That
doesn't exist on GitHub Pages.

**What changed**: those redirects now happen entirely client-side, reading from a
new `vse-landing/public/config.js` (plain JS, loaded before `script.js`) instead of
hitting a server route. **Verified**: served `vse-landing/public/` with a plain
Python `http.server` (zero Node, zero Express — the closest local simulation of
GitHub Pages' actual hosting model) and confirmed `index.html`, `config.js`, and
`script.js` all serve correctly and `config.js` populates `window.VSE_CONFIG` as
expected.

### 3.2 Installer downloads — don't commit `.exe`/`.dmg` into this repo

The download buttons used to point at relative `/downloads/...` paths, which only
worked if whatever server was hosting the site also happened to be serving those
exact files. Fixed to point at configurable URLs instead
(`config.js`'s `downloads` object), intended to point at a **GitHub Release**, not
a file inside the Pages repo — GitHub Pages has an unenforced but real ~100MB/file,
~1GB/repo expectation that isn't meant for shipping installer binaries. Once you've
run `scripts/build-windows.ps1` / `scripts/build-macos.sh` for real and have actual
installer files, publish them with:
```
gh release create v1.0.0 vscode-egypt-setup.exe vscode-egypt-arm64.dmg vscode-egypt-x64.dmg
```

### 3.3 Deploying — two options

**Option A — GitHub Actions (recommended, automatic on every push)**

`.github/workflows/deploy-pages.yml` is included. Set these once in your repo's
**Settings → Secrets and variables → Actions → Variables**:
```
PAYMENT_PORTAL_URL = https://<your-portal>.up.railway.app
BACKEND_URL         = https://<your-backend>.up.railway.app
DOWNLOAD_BASE_URL   = https://github.com/<you>/<repo>/releases/latest/download
```
Then enable Pages in **Settings → Pages → Source: GitHub Actions**. Every push to
`main` touching `vse-landing/public/**` redeploys automatically; you can also
trigger it manually from the Actions tab.

**Verified**: the workflow's YAML parses correctly, and the `sed`-based config
injection was tested directly against the real `config.js` file — confirmed it
produces valid, correctly-substituted JavaScript. **Not verified**: an actual run
through GitHub's own Actions runner (that requires a real GitHub repo to push to,
which doesn't exist yet for this project) — the individual pieces (YAML validity,
substitution logic, official `actions/deploy-pages` action) are each independently
standard/correct, but the full pipeline hasn't been observed end-to-end on GitHub's
infrastructure.

**Option B — manual script**

```bash
PAYMENT_PORTAL_URL=https://your-portal.up.railway.app \
BACKEND_URL=https://your-backend.up.railway.app \
DOWNLOAD_BASE_URL=https://github.com/you/vscode-egypt/releases/latest/download \
./scripts/deploy-landing-github-pages.sh
```
Pushes directly to a `gh-pages` branch on your repo's configured `origin` remote.
**Verified**: the config-injection portion (identical logic to the workflow) —
tested directly, confirmed correct output. The `git push` step requires a real
repo with a remote configured, which this sandbox doesn't have, so that exact step
hasn't been run for real — but it's a plain, standard `git init` + `commit` +
`push --force origin HEAD:gh-pages` sequence.

### 3.4 Hidden admin PWA

New static files, deployed exactly like everything else in `vse-landing/public/`
— no build step, no separate hosting: `admin.html`, `admin.js`, `admin-style.css`,
`sw.js`, `admin-trigger.js`. The long-press trigger lives in the footer of
`index.html` (`#stealthTrigger`, wrapping the copyright line's trailing period).

This uses the same `window.VSE_CONFIG.backendUrl` that `config.js` already
defines (previously unused — the comment in `config.js` calling this out as
"kept here for a future feature" was written before this existed). No new config
values are needed for GitHub Actions/the manual deploy script to inject; both
already substitute `backendUrl` today.

**Read this before deploying**: the long-press + passcode modal is UX obscurity,
not the real security boundary — GitHub Pages serves `admin-trigger.js`'s source
to anyone, same as every other file in this repo. The actual boundary is
server-side, in `vse-backend`'s `/v1/payment/admin/login` (bcrypt-hashed
passcode comparison + persistent lockout — see 1.6 above). Don't rely on the
trigger being hard to find as your actual security model.

**Verified**: served `vse-landing/public/` with a plain Python `http.server`
(same zero-Node simulation as 3.1) and confirmed `admin.html`, `admin.js`,
`admin-style.css`, `sw.js`, and `admin-trigger.js` all serve with `200`, and
that `#stealthTrigger` is present in the served `index.html`. **Not verified**:
an actual 3-second long-press in a real touch/mouse browser session, service
worker registration against a live HTTPS origin (service workers require HTTPS
or `localhost` — won't register at all over the plain HTTP this sandbox uses),
or a real push notification round-trip — all three need a real browser and, for
the service worker specifically, real HTTPS hosting (which GitHub Pages
provides automatically, but this sandbox doesn't simulate).

## 4. The IDE itself — pointing it at your real backend

`product.json`'s `vscodeEgyptLicenseApiBaseUrl` field is the **single place**
every custom module (auth, chat, Ctrl+K, workspace indexing, agent mode, billing,
inline completion — all 12 of them) reads the backend's API URL from. Confirmed by
grepping every custom `.ts` file in this project — they all reference this exact
same field via the same pattern, nothing hardcodes a different URL anywhere else.

Before building the installer, change:
```json
"vscodeEgyptLicenseApiBaseUrl": "REPLACE_WITH_YOUR_RAILWAY_BACKEND_URL/v1"
```
to your real backend's URL, e.g.:
```json
"vscodeEgyptLicenseApiBaseUrl": "https://vse-backend-production.up.railway.app/v1"
```
This is a one-line change in one file — no patches need editing for this.

## 5. Order of operations, start to finish

1. Deploy `vse-backend` to Railway first (needs its Volume + env vars set up).
2. Deploy `vse-payment-portal` to Railway, pointing `VSE_BACKEND_URL` at step 1's URL.
3. Update `product.json`'s API base URL to step 1's URL, rebuild the IDE installers.
4. Set GitHub repo variables (or manual script env vars) using step 1 and 2's URLs,
   deploy `vse-landing` to GitHub Pages.
5. Once you have real installer files, publish them as a GitHub Release and set
   `DOWNLOAD_BASE_URL` accordingly, redeploy the landing page.
