const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { sendOtpEmail } = require('../services/email');

const router = express.Router();

const ACCESS_TOKEN_SECRET = process.env.LICENSE_JWT_SECRET; // reuse same signing secret family
const OTP_TTL_MINUTES = 15;
const OTP_MAX_ATTEMPTS = 5;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7; // Reduced from 30 days for better security

if (!ACCESS_TOKEN_SECRET) {
    throw new Error('LICENSE_JWT_SECRET is not set — auth routes cannot sign tokens.');
}

function generateOtp() {
    // 6-digit numeric code — easy to type from an email on a phone.
    return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashToken(raw) {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /v1/auth/signup
 * Body: { email, password }
 * Creates an UNVERIFIED user and emails a 6-digit OTP. The account cannot log
 * in until /verify-email succeeds.
 */
router.post('/signup', async (req, res) => {
    const { email, password } = req.body || {};

    // Enhanced input validation
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'invalid_request', message: 'Valid email address required.' });
    }
    
    if (typeof password !== 'string') {
        return res.status(400).json({ error: 'invalid_request', message: 'Password must be a string.' });
    }
    
    if (password.length < 8) {
        return res.status(400).json({ error: 'invalid_request', message: 'Password must be at least 8 characters.' });
    }
    
    if (password.length > 128) {
        return res.status(400).json({ error: 'invalid_request', message: 'Password must be less than 128 characters.' });
    }
    
    // Password strength validation
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
        return res.status(400).json({ 
            error: 'invalid_request', 
            message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number.' 
        });
    }

    const existing = db.prepare('SELECT id, email_verified FROM users WHERE email = ?').get(email);
    if (existing && existing.email_verified) {
        return res.status(409).json({ error: 'email_taken', message: 'Email address already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    let userId;

    if (existing) {
        // Unverified account retrying signup — update password, issue a fresh OTP.
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, existing.id);
        userId = existing.id;
    } else {
        const info = db.prepare('INSERT INTO users (email, password_hash, plan, email_verified) VALUES (?, ?, ?, 0)')
            .run(email, passwordHash, 'free');
        userId = info.lastInsertRowid;
    }

    try {
        await issueAndSendOtp(userId, email, 'signup_verify');
    } catch (err) {
        console.error('[vse-backend/auth] failed to send signup OTP email:', err.message);
        return res.status(502).json({ error: 'email_send_failed', message: 'Could not send the verification email. Please try again shortly.' });
    }

    return res.status(201).json({ userId, message: 'Verification code sent to your email.' });
});

/**
 * POST /v1/auth/verify-email
 * Body: { userId, code }
 */
router.post('/verify-email', async (req, res) => {
    const { userId, code } = req.body || {};
    if (!userId || !code) {
        return res.status(400).json({ error: 'invalid_request' });
    }

    const result = await consumeOtp(userId, code, 'signup_verify');
    if (!result.ok) {
        return res.status(400).json({ error: result.reason });
    }

    db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId);

    const user = db.prepare('SELECT id, email, plan FROM users WHERE id = ?').get(userId);
    const tokens = await issueSessionTokens(user);
    return res.json({ verified: true, user: { id: user.id, email: user.email, plan: user.plan }, ...tokens });
});

/**
 * POST /v1/auth/resend-otp
 * Body: { userId }
 * Rate-limited at the app level via the global /v1 rate limiter in server.js;
 * add a stricter per-user limiter here if abuse becomes an issue.
 */
router.post('/resend-otp', async (req, res) => {
    const { userId } = req.body || {};
    const user = db.prepare('SELECT id, email, email_verified FROM users WHERE id = ?').get(userId);
    if (!user) {
        return res.status(404).json({ error: 'not_found' });
    }
    if (user.email_verified) {
        return res.status(400).json({ error: 'already_verified' });
    }

    try {
        await issueAndSendOtp(user.id, user.email, 'signup_verify');
    } catch (err) {
        console.error('[vse-backend/auth] failed to resend OTP email:', err.message);
        return res.status(502).json({ error: 'email_send_failed', message: 'Could not send the verification email. Please try again shortly.' });
    }
    return res.json({ message: 'Verification code resent.' });
});

/**
 * POST /v1/auth/login
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};
    
    // Enhanced input validation
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'invalid_request', message: 'Valid email address required.' });
    }
    
    if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'invalid_request', message: 'Password required.' });
    }
    
    if (password.length > 128) {
        return res.status(400).json({ error: 'invalid_request', message: 'Password too long.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    // Compare against a dummy hash even when the user doesn't exist, so response
    // timing doesn't leak which emails are registered.
    const hashToCheck = user ? user.password_hash : '$2a$12$invalidsaltinvalidsaltinvalidsa.invalidhashinvalidhashinvalidha';
    const passwordOk = await bcrypt.compare(password, hashToCheck);

    if (!user || !passwordOk) {
        // Log failed login attempt
        console.warn(`[SECURITY] Failed login attempt for email: ${email}`);
        return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password.' });
    }
    if (!user.email_verified) {
        return res.status(403).json({ error: 'email_not_verified', userId: user.id, message: 'Please verify your email first.' });
    }

    // Log successful login
    console.log(`[SECURITY] Successful login for user: ${user.id}`);
    
    const tokens = await issueSessionTokens(user);
    return res.json({ user: { id: user.id, email: user.email, plan: user.plan }, ...tokens });
});

/**
 * POST /v1/auth/refresh
 * Body: { refreshToken }
 * Rotates the refresh token (revokes the old session row, issues a new one) —
 * standard rotation so a leaked, already-used refresh token becomes useless.
 */
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
        return res.status(400).json({ error: 'invalid_request' });
    }

    const tokenHash = hashToken(refreshToken);
    const session = db.prepare(
        'SELECT * FROM sessions WHERE refresh_token_hash = ? AND revoked_at IS NULL'
    ).get(tokenHash);

    if (!session || new Date(session.expires_at).getTime() < Date.now()) {
        return res.status(401).json({ error: 'invalid_refresh_token' });
    }

    db.prepare('UPDATE sessions SET revoked_at = datetime(\'now\') WHERE id = ?').run(session.id);

    const user = db.prepare('SELECT id, email, plan FROM users WHERE id = ?').get(session.user_id);
    const tokens = await issueSessionTokens(user);
    return res.json({ user: { id: user.id, email: user.email, plan: user.plan }, ...tokens });
});

/**
 * GET /v1/auth/me
 * Requires a valid access token (Authorization: Bearer <accessToken>).
 * Used by the IDE's login modal to check "am I already signed in?" on startup.
 */
router.get('/me', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return res.status(401).json({ error: 'not_authenticated' });
    }

    let payload;
    try {
        payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
    } catch {
        return res.status(401).json({ error: 'invalid_token' });
    }
    if (payload.type !== 'access') {
        return res.status(401).json({ error: 'invalid_token' });
    }

    const user = db.prepare('SELECT id, email, plan FROM users WHERE id = ?').get(payload.sub);
    if (!user) {
        return res.status(401).json({ error: 'not_authenticated' });
    }

    return res.json({ user });
});

// ---- helpers ----

async function issueAndSendOtp(userId, email, purpose) {
    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    // Invalidate any prior unconsumed OTPs of the same purpose for this user.
    db.prepare('UPDATE email_otps SET consumed_at = datetime(\'now\') WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL')
        .run(userId, purpose);

    db.prepare('INSERT INTO email_otps (user_id, code_hash, purpose, expires_at) VALUES (?, ?, ?, ?)')
        .run(userId, codeHash, purpose, expiresAt);

    await sendOtpEmail(email, code, purpose);
}

async function consumeOtp(userId, code, purpose) {
    const otp = db.prepare(
        'SELECT * FROM email_otps WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL ORDER BY id DESC LIMIT 1'
    ).get(userId, purpose);

    if (!otp) {
        return { ok: false, reason: 'no_pending_otp' };
    }
    if (new Date(otp.expires_at).getTime() < Date.now()) {
        return { ok: false, reason: 'otp_expired' };
    }
    if (otp.attempt_count >= OTP_MAX_ATTEMPTS) {
        return { ok: false, reason: 'too_many_attempts' };
    }

    const matches = await bcrypt.compare(code, otp.code_hash);
    if (!matches) {
        db.prepare('UPDATE email_otps SET attempt_count = attempt_count + 1 WHERE id = ?').run(otp.id);
        return { ok: false, reason: 'invalid_code' };
    }

    db.prepare('UPDATE email_otps SET consumed_at = datetime(\'now\') WHERE id = ?').run(otp.id);
    return { ok: true };
}

async function issueSessionTokens(user) {
    const accessToken = jwt.sign(
        { 
            sub: user.id, 
            plan: user.plan, 
            type: 'access',
            iat: Math.floor(Date.now() / 1000) // Issued at time
        },
        ACCESS_TOKEN_SECRET,
        { 
            expiresIn: ACCESS_TOKEN_TTL,
            algorithm: 'HS256' // Explicitly specify algorithm
        }
    );

    const refreshToken = crypto.randomBytes(48).toString('hex');
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Invalidate any existing sessions for this user (optional: for single-session policy)
    // db.prepare('UPDATE sessions SET revoked_at = datetime(\'now\') WHERE user_id = ? AND revoked_at IS NULL').run(user.id);

    db.prepare('INSERT INTO sessions (user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?)')
        .run(user.id, refreshTokenHash, expiresAt);

    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL };
}

module.exports = router;
