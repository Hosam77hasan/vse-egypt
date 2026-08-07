const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const paymentProvider = require('../services/payment');
const { saveSubscription, getPublicKey } = require('../services/push');
const { handleAdminLogin, requireAdminSession } = require('../middleware/adminAuth');
const { SECRET: CUSTOMER_JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// File upload for payment screenshots — stored locally, served back for admin review
const uploadDir = path.join(__dirname, '..', 'uploads', 'payment-screenshots');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }
const upload = multer({ storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
}), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'));
}});

const PAYMENT_METHODS = ['instapay', 'vodafone_cash', 'paypal', 'crypto'];
const CURRENCIES = ['EGP', 'USD'];

// How many tokens a manual request converts to, per unit of currency. Configurable
// via env because unlike the automated topup.js ladder (fixed EGP tiers), a manual
// submission can be any amount, so this needs a rate rather than a lookup table.
const TOKENS_PER_EGP = Number(process.env.TOKENS_PER_EGP || 2000);
const TOKENS_PER_USD = Number(process.env.TOKENS_PER_USD || 100_000);

function tokensFor(amount, currency) {
    const rate = currency === 'USD' ? TOKENS_PER_USD : TOKENS_PER_EGP;
    return Math.round(amount * rate);
}

function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Same shape as requireValidLicense's 'access' branch, but optional — a manual
 * payment request can come from a signed-in user (Bearer token present) or a
 * guest who only typed their account email into the payment portal form. */
function readOptionalUserId(req) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return null;

    try {
        const payload = jwt.verify(token, CUSTOMER_JWT_SECRET);
        if (payload.type === 'access') {
            const user = db.prepare('SELECT id FROM users WHERE id = ?').get(payload.sub);
            return user ? user.id : null;
        }
    } catch {
        // Not a valid/parseable customer token — fall through and treat as a guest.
    }
    return null;
}

/**
 * POST /v1/payment/request
 * Body: { email, amount, currency, paymentMethod, transactionRef, notes? }
 * Public — rate-limited by the global /v1 limiter in server.js (this route is
 * registered ahead of the requireValidLicense gate, same reason /v1/topup/confirm
 * and /v1/license/issue are). Anyone can submit a claimed transaction; nothing is
 * credited until an admin approves it from the hidden dashboard.
 */
router.post('/request', upload.single('screenshot'), (req, res) => {
    const { email, amount, currency, paymentMethod, transactionRef, notes } = req.body || {};

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'invalid_request', message: 'Valid email required.' });
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return res.status(400).json({ error: 'invalid_request', message: 'amount must be a positive number.' });
    }
    if (!CURRENCIES.includes(currency)) {
        return res.status(400).json({ error: 'invalid_request', message: `currency must be one of: ${CURRENCIES.join(', ')}` });
    }
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
        return res.status(400).json({ error: 'invalid_request', message: `paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}` });
    }
    if (typeof transactionRef !== 'string' || transactionRef.trim().length === 0) {
        return res.status(400).json({ error: 'invalid_request', message: 'transactionRef is required.' });
    }
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 500)) {
        return res.status(400).json({ error: 'invalid_request', message: 'notes must be a string under 500 characters.' });
    }

    const screenshotPath = req.file ? '/uploads/payment-screenshots/' + req.file.filename : null;

    const request = paymentProvider.createRequest({
        userId: readOptionalUserId(req),
        email,
        amount: amountNum,
        currency,
        tokensRequested: tokensFor(amountNum, currency),
        paymentMethod,
        transactionRef: transactionRef.trim(),
        notes: notes?.trim() || null,
        screenshotPath,
    });

    return res.status(201).json({
        submitted: true,
        request: {
            id: request.id,
            status: request.status,
            tokensRequested: request.tokens_requested,
        },
    });
});

// Tighter than the global /v1 limiter — same reasoning as server.js's authLimiter,
// this is exactly where brute-forcing a 7-digit passcode would happen. The
// persistent DB-backed lockout in middleware/adminAuth.js is the real backstop;
// this is the first, cheaper line of defense.
const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'rate_limited', message: 'Too many admin login attempts — try again later.' },
});

/** POST /v1/payment/admin/login — Body: { passcode } */
router.post('/admin/login', adminLoginLimiter, handleAdminLogin);

/**
 * GET /v1/payment/admin/requests?status=pending
 * status is optional; omit it to list every request regardless of status.
 */
router.get('/admin/requests', requireAdminSession, (req, res) => {
    const { status } = req.query;
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'invalid_request', message: 'status must be pending, approved, or rejected.' });
    }
    return res.json({ requests: paymentProvider.listByStatus(status || null) });
});

router.post('/admin/requests/:id/approve', requireAdminSession, (req, res) => {
    const result = paymentProvider.approve(Number(req.params.id));
    if (!result.ok) {
        const code = result.reason === 'not_found' ? 404 : 409;
        return res.status(code).json({ error: result.reason });
    }
    return res.json({ approved: true, request: result.request });
});

router.post('/admin/requests/:id/reject', requireAdminSession, (req, res) => {
    const result = paymentProvider.reject(Number(req.params.id));
    if (!result.ok) {
        const code = result.reason === 'not_found' ? 404 : 409;
        return res.status(code).json({ error: result.reason });
    }
    return res.json({ rejected: true, request: result.request });
});

/**
 * GET /v1/payment/admin/vapid-public-key
 * The admin PWA needs this to call PushManager.subscribe(). Behind
 * requireAdminSession like every other /admin/* route even though a VAPID
 * public key isn't secret by design — least-privilege default, and it also
 * doubles as a cheap way for admin.js to tell "push not configured" (null
 * key) apart from "not logged in" (403, handled by requireAdminSession).
 */
router.get('/admin/vapid-public-key', requireAdminSession, (_req, res) => {
    res.json({ publicKey: getPublicKey() });
});

/**
 * POST /v1/payment/admin/subscribe-push
 * Body: a standard PushSubscription (from PushManager.subscribe() in the admin
 * PWA's sw.js registration) — { endpoint, keys: { p256dh, auth } }.
 */
router.post('/admin/subscribe-push', requireAdminSession, (req, res) => {
    try {
        saveSubscription(req.body);
    } catch (err) {
        return res.status(400).json({ error: 'invalid_subscription' });
    }
    return res.json({ subscribed: true });
});

// Export helper functions for testing
router.tokensFor = tokensFor;
router.isValidEmail = isValidEmail;
router.PAYMENT_METHODS = PAYMENT_METHODS;
router.CURRENCIES = CURRENCIES;

module.exports = router;
