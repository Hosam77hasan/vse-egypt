const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { SECRET } = require('../middleware/auth');

const router = express.Router();

const INTERNAL_SECRET = process.env.PAYMENT_PORTAL_INTERNAL_SECRET;
if (!INTERNAL_SECRET) {
    throw new Error('PAYMENT_PORTAL_INTERNAL_SECRET is not set — refusing to start with an open /license/issue endpoint.');
}

/**
 * POST /v1/license/verify
 * Called by the desktop IDE's licenseGate.contribution.ts on startup.
 * Body: { token: string }
 * This mirrors the ILicenseVerifyResponse shape the contribution expects.
 */
router.post('/verify', (req, res) => {
    const { token } = req.body || {};
    if (!token) {
        return res.json({ valid: false, reason: 'not_found' });
    }

    let payload;
    try {
        payload = jwt.verify(token, SECRET);
    } catch (err) {
        return res.json({ valid: false, reason: err.name === 'TokenExpiredError' ? 'expired' : 'invalid' });
    }

    const license = db.prepare('SELECT * FROM licenses WHERE license_key = ? AND user_id = ?')
        .get(payload.jti, payload.sub);

    if (!license || license.status !== 'active') {
        return res.json({ valid: false, reason: license?.status ?? 'not_found' });
    }
    if (new Date(license.expires_at).getTime() < Date.now()) {
        db.prepare('UPDATE licenses SET status = ? WHERE id = ?').run('expired', license.id);
        return res.json({ valid: false, reason: 'expired' });
    }

    return res.json({ valid: true, plan: payload.plan, expiresAt: license.expires_at });
});

/**
 * POST /v1/license/issue
 * INTERNAL ONLY — must sit behind a network boundary (VPC/internal-only ingress)
 * or a service-to-service secret, never exposed to the public internet as-is.
 * Called by vse-payment-portal's server AFTER it has confirmed a transaction with
 * the payment gateway (Vodafone Cash / Meeza) webhook — never on the client's say-so.
 */
router.post('/issue', (req, res) => {
    const internalSecret = req.headers['x-internal-secret'];
    if (!internalSecret || internalSecret !== INTERNAL_SECRET) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const { userId, plan, durationDays, paymentRef } = req.body || {};
    if (!userId || !plan || !durationDays || !paymentRef) {
        return res.status(400).json({ error: 'invalid_request' });
    }

    const jti = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
        INSERT INTO licenses (user_id, license_key, status, expires_at, payment_ref)
        VALUES (?, ?, 'active', ?, ?)
    `).run(userId, jti, expiresAt, paymentRef);

    const token = jwt.sign(
        { sub: userId, plan, jti },
        SECRET,
        { expiresIn: `${durationDays}d` }
    );

    return res.json({ token, expiresAt });
});

module.exports = router;
