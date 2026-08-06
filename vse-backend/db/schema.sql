-- VS Code Egypt — backend schema (SQLite via better-sqlite3)
-- Swap for Postgres/MySQL at scale; schema translates directly.

CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,        -- bcrypt/argon2 hash, never plaintext
    plan            TEXT NOT NULL DEFAULT 'free',   -- free | pro | team
    email_verified  INTEGER NOT NULL DEFAULT 0,      -- 0 | 1
    credit_balance_tokens INTEGER NOT NULL DEFAULT 0, -- prepaid top-up balance, never resets monthly (unlike the plan's base allowance)
    credit_consumed_tokens INTEGER NOT NULL DEFAULT 0, -- lifetime amount drawn FROM the credit balance (only incremented once the monthly plan allowance is exhausted — see tokenGuard.js)
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS topups (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    amount_egp      INTEGER NOT NULL,       -- 100 | 200 | 400 | 800 | 1000
    tokens_granted  INTEGER NOT NULL,
    payment_ref     TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_topups_user ON topups(user_id);

CREATE TABLE IF NOT EXISTS email_otps (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    code_hash       TEXT NOT NULL,          -- OTP is hashed at rest, same reasoning as passwords
    purpose         TEXT NOT NULL,          -- 'signup_verify' | 'password_reset'
    expires_at      TEXT NOT NULL,
    consumed_at     TEXT,
    attempt_count   INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    refresh_token_hash TEXT NOT NULL,       -- refresh token is hashed at rest
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at      TEXT NOT NULL,
    revoked_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_otps_user ON email_otps(user_id, purpose);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS licenses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    license_key     TEXT UNIQUE NOT NULL,  -- the JWT jti (unique id), not the JWT itself
    status          TEXT NOT NULL DEFAULT 'active', -- active | expired | revoked
    issued_at       TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at      TEXT NOT NULL,
    payment_ref     TEXT                    -- reference id from the payment portal transaction
);

CREATE TABLE IF NOT EXISTS token_usage (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    period_month    TEXT NOT NULL,          -- 'YYYY-MM', usage resets per period
    prompt_tokens   INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    request_count   INTEGER NOT NULL DEFAULT 0,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, period_month)
);

CREATE TABLE IF NOT EXISTS token_usage_by_model (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    period_month    TEXT NOT NULL,
    model_alias     TEXT NOT NULL,          -- 'driver' | 'leader' | 'innovator'
    prompt_tokens   INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    request_count   INTEGER NOT NULL DEFAULT 0,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, period_month, model_alias)
);

CREATE TABLE IF NOT EXISTS workspaces (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    workspace_key   TEXT NOT NULL,          -- stable hash of the workspace root path, client-supplied
    last_indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
    file_count      INTEGER NOT NULL DEFAULT 0,
    chunk_count     INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, workspace_key)
);

CREATE TABLE IF NOT EXISTS workspace_chunks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id    INTEGER NOT NULL REFERENCES workspaces(id),
    file_path       TEXT NOT NULL,          -- relative to workspace root
    chunk_index     INTEGER NOT NULL,       -- ordinal within the file
    start_line      INTEGER NOT NULL,
    end_line        INTEGER NOT NULL,
    content         TEXT NOT NULL,
    term_freqs      TEXT NOT NULL,          -- JSON: { term: count } — see indexer.js
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workspace_chunks_workspace ON workspace_chunks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_chunks_file ON workspace_chunks(workspace_id, file_path);
CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id);

-- Manual payment queue (services/payment/ManualPaymentProvider.js). A user submits
-- proof of an out-of-band transfer (InstaPay / Vodafone Cash / PayPal / crypto);
-- an admin reviews and approves/rejects from the hidden PWA dashboard. user_id is
-- nullable because a request can arrive from someone who typed their account email
-- but isn't carrying a Bearer token in the submitting browser (e.g. GitHub Pages
-- payment portal without an active desktop-app session) — reviewed by email in
-- that case, same as topups already key off user_id once matched.
CREATE TABLE IF NOT EXISTS payment_requests (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER REFERENCES users(id),
    email               TEXT NOT NULL,
    amount              REAL NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'EGP',       -- 'EGP' | 'USD'
    tokens_requested    INTEGER NOT NULL,
    payment_method      TEXT NOT NULL,                      -- 'instapay' | 'vodafone_cash' | 'paypal' | 'crypto'
    transaction_ref     TEXT NOT NULL,
    notes               TEXT,
    status              TEXT NOT NULL DEFAULT 'pending',     -- 'pending' | 'approved' | 'rejected'
    reviewed_at         TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_requests_user ON payment_requests(user_id);

-- Web Push subscriptions for the hidden admin PWA (services/push.js). Not tied to
-- a `users` row — the admin panel has its own passcode-based session (see
-- middleware/adminAuth.js), separate from the customer auth system entirely.
CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint        TEXT UNIQUE NOT NULL,
    p256dh          TEXT NOT NULL,
    auth            TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Failed-attempt ledger behind /v1/payment/admin/login, in addition to the
-- in-memory express-rate-limit on the route. Persisted (unlike express-rate-limit's
-- in-memory store) so a lockout survives a redeploy/restart — this endpoint gates
-- real money approvals behind a 7-digit numeric passcode, so it's worth the extra
-- table. ip_hash, never the raw IP, since this table has no other retention policy.
CREATE TABLE IF NOT EXISTS admin_login_attempts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_hash         TEXT NOT NULL,
    success         INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_ip ON admin_login_attempts(ip_hash, created_at);
