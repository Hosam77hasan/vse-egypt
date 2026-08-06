const jwt = require('jsonwebtoken');
const db = require('../db');

const SECRET = process.env.LICENSE_JWT_SECRET;

if (!SECRET) {
    throw new Error('LICENSE_JWT_SECRET is not set — refusing to start with an unsigned/insecure config.');
}

/**
 * Accepts TWO token shapes, both signed with the same secret:
 *
 *   1. Auth-system access tokens (routes/auth.js): { sub, plan, type: 'access' }.
 *      This is the day-to-day path — every signed-in user gets one of these.
 *      Plan is read live from the `users` table (not trusted from the token's
 *      `plan` claim, since a 15-minute-lived access token could be stale
 *      relative to a just-completed upgrade/downgrade).
 *
 *   2. Legacy license tokens (routes/license.js): { sub, plan, jti }, issued
 *      directly by the payment portal for gift codes / offline activation
 *      flows that don't go through routes/auth.js at all. Verified against
 *      the `licenses` table as before.
 *
 * A token must match one shape or the other — this is not a fallback chain
 * that silently accepts a malformed token of either kind.
 */
function requireValidLicense(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ valid: false, reason: 'not_found', message: 'Authentication token required.' });
    }

    // Token size validation (prevent oversized tokens)
    if (token.length > 2048) {
        return res.status(401).json({ valid: false, reason: 'invalid', message: 'Token too large.' });
    }

    let payload;
    try {
        payload = jwt.verify(token, SECRET, {
            algorithms: ['HS256'], // Restrict to secure algorithms
            maxAge: '24h', // Maximum token age
        });
    } catch (err) {
        const reason = err.name === 'TokenExpiredError' ? 'expired' : 'invalid';
        return res.status(401).json({ valid: false, reason, message: `Token ${reason}.` });
    }

    // Validate token structure
    if (!payload || typeof payload !== 'object') {
        return res.status(401).json({ valid: false, reason: 'invalid', message: 'Invalid token structure.' });
    }

    if (payload.type === 'access') {
        // Additional validation for access tokens
        if (!payload.sub || !payload.plan) {
            return res.status(401).json({ valid: false, reason: 'invalid', message: 'Invalid token claims.' });
        }
        
        const user = db.prepare('SELECT id, plan, email_verified FROM users WHERE id = ?').get(payload.sub);
        if (!user || !user.email_verified) {
            return res.status(401).json({ valid: false, reason: 'not_found', message: 'User not found or not verified.' });
        }
        
        // Verify plan matches (in case of recent changes)
        if (user.plan !== payload.plan) {
            // Plan changed since token was issued - still valid but log it
            console.log(`[SECURITY] Plan mismatch for user ${user.id}: token=${payload.plan}, actual=${user.plan}`);
        }
        
        req.user = { id: user.id, plan: user.plan };
        return next();
    }

    if (payload.jti) {
        // License token validation
        if (!payload.sub || !payload.jti) {
            return res.status(401).json({ valid: false, reason: 'invalid', message: 'Invalid license token claims.' });
        }
        
        const license = db.prepare(
            'SELECT * FROM licenses WHERE license_key = ? AND user_id = ?'
        ).get(payload.jti, payload.sub);

        if (!license) {
            return res.status(401).json({ valid: false, reason: 'not_found', message: 'License not found.' });
        }
        if (license.status !== 'active') {
            return res.status(401).json({ valid: false, reason: license.status, message: `License is ${license.status}.` });
        }
        if (new Date(license.expires_at).getTime() < Date.now()) {
            db.prepare('UPDATE licenses SET status = ? WHERE id = ?').run('expired', license.id);
            return res.status(401).json({ valid: false, reason: 'expired', message: 'License has expired.' });
        }

        req.user = { id: payload.sub, plan: payload.plan, licenseId: license.id };
        return next();
    }

    return res.status(401).json({ valid: false, reason: 'invalid', message: 'Invalid token type.' });
}

module.exports = { requireValidLicense, SECRET };
