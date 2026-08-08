const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const ADMIN_PASSCODE_HASH = process.env.ADMIN_PASSCODE_HASH;

if (!ADMIN_JWT_SECRET) {
    throw new Error('ADMIN_JWT_SECRET is not set — refusing to start with an unsigned admin session token.');
}
if (!ADMIN_PASSCODE_HASH) {
    throw new Error(
        'ADMIN_PASSCODE_HASH is not set — refusing to start. The admin passcode is never stored or compared as ' +
        'plaintext; generate a bcrypt hash of your passcode (see scripts/hash-admin-passcode.js) and set it here.'
    );
}

const ADMIN_SESSION_TTL = '4h'; // Reduced from 8h for better security
const MAX_ATTEMPTS = Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS || 3); // Reduced from 5
const LOCKOUT_MINUTES = Number(process.env.ADMIN_LOGIN_LOCKOUT_MINUTES || 60); // Increased from 30
const MIN_PASSCODE_LENGTH = 7; // Minimum passcode length
const PASSCODE_REGEX = /^[0-9]+$/; // Only numeric passcodes allowed

/** Never store/log the raw IP — this table has no other retention/redaction policy. */
function hashIp(ip) {
    return crypto.createHash('sha256').update(String(ip || 'unknown')).digest('hex');
}

/**
 * True if this IP has MAX_ATTEMPTS+ failed admin logins within the lockout
 * window. Persisted in SQLite (not just express-rate-limit's in-memory store,
 * which is also applied on the route as a first line of defense) so a lockout
 * survives a redeploy/restart — this gates real money approvals behind a
 * 7-digit numeric passcode, worth the extra durability.
 */
function isLockedOut(ipHash) {
    const row = db.prepare(`
        SELECT COUNT(*) AS failures FROM admin_login_attempts
        WHERE ip_hash = ? AND success = 0
          AND created_at >= datetime('now', ?)
    `).get(ipHash, `-${LOCKOUT_MINUTES} minutes`);
    return row.failures >= MAX_ATTEMPTS;
}

function recordAttempt(ipHash, success) {
    db.prepare('INSERT INTO admin_login_attempts (ip_hash, success) VALUES (?, ?)').run(ipHash, success ? 1 : 0);
}

/**
 * POST /v1/payment/admin/login handler. Verifies the passcode against the
 * bcrypt hash in ADMIN_PASSCODE_HASH (never a plaintext comparison), enforces
 * the persistent lockout above, and issues a short-lived admin session JWT —
 * a completely separate token family from customer access tokens (middleware/auth.js),
 * signed with its own secret, carrying no user identity at all.
 */
async function handleAdminLogin(req, res) {
    const ipHash = hashIp(req.ip);

    if (isLockedOut(ipHash)) {
        return res.status(429).json({
            error: 'locked_out',
            message: `Too many failed attempts. Try again in up to ${LOCKOUT_MINUTES} minutes.`,
        });
    }

    const { passcode } = req.body || {};
    
    // Enhanced input validation
    if (typeof passcode !== 'string' || passcode.length === 0) {
        return res.status(400).json({ error: 'invalid_request', message: 'Passcode is required.' });
    }
    
    if (passcode.length < MIN_PASSCODE_LENGTH) {
        return res.status(400).json({ error: 'invalid_request', message: `Passcode must be at least ${MIN_PASSCODE_LENGTH} characters.` });
    }
    
    if (!PASSCODE_REGEX.test(passcode)) {
        return res.status(400).json({ error: 'invalid_request', message: 'Passcode must contain only numbers.' });
    }

    const match = await bcrypt.compare(passcode, ADMIN_PASSCODE_HASH);
    recordAttempt(ipHash, match);

    if (!match) {
        // Log failed attempt for security monitoring
        console.warn(`[SECURITY] Failed admin login attempt from IP hash: ${ipHash}`);
        return res.status(401).json({ error: 'invalid_passcode' });
    }

    // Log successful login
    console.log(`[SECURITY] Successful admin login from IP hash: ${ipHash}`);
    
    const token = jwt.sign({ 
        type: 'admin_session',
        iat: Math.floor(Date.now() / 1000),
        ip: ipHash // Include IP hash in token for additional verification
    }, ADMIN_JWT_SECRET, { expiresIn: ADMIN_SESSION_TTL });
    
    return res.json({ 
        token, 
        expiresIn: ADMIN_SESSION_TTL,
        message: 'Login successful. Session will expire in 4 hours.'
    });
}

/** Guards every /v1/payment/admin/* route below the login endpoint. */
function requireAdminSession(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(403).json({ error: 'forbidden', message: 'Authentication required.' });
    }

    try {
        const payload = jwt.verify(token, ADMIN_JWT_SECRET);
        if (payload.type !== 'admin_session') {
            return res.status(403).json({ error: 'forbidden', message: 'Invalid token type.' });
        }
        
        // Additional IP verification (optional, can be disabled in development)
        if (process.env.NODE_ENV === 'production' && payload.ip) {
            const currentIpHash = hashIp(req.ip);
            if (payload.ip !== currentIpHash) {
                console.warn(`[SECURITY] IP mismatch in admin session. Token IP: ${payload.ip}, Current IP: ${currentIpHash}`);
                return res.status(403).json({ error: 'forbidden', message: 'IP address mismatch.' });
            }
        }
        
        // Add user info to request for logging
        req.adminSession = payload;
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'session_expired', message: 'Admin session has expired. Please login again.' });
        }
        return res.status(403).json({ error: 'forbidden', message: 'Invalid token.' });
    }

    return next();
}

module.exports = { handleAdminLogin, requireAdminSession };
