require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const { requireValidLicense } = require('./middleware/auth');
const chatRoutes = require('./routes/chat');
const licenseRoutes = require('./routes/license');
const authRoutes = require('./routes/auth');
const billingRoutes = require('./routes/billing');
const workspaceRoutes = require('./routes/workspace');
const agentRoutes = require('./routes/agent');
const topupRoutes = require('./routes/topup');
const paymentRoutes = require('./routes/payment');

const app = express();

// ---------- Payment Portal Integration ----------
// Instead of a separate Railway service, the payment portal's static pages and
// checkout endpoints are mounted directly on the backend. This keeps everything
// on one domain (no CORS headaches) and simplifies deployment to one service.
const PAYMENT_PORTAL_PUBLIC = path.join(__dirname, '..', 'vse-payment-portal', 'public');
const PAYMENT_PORTAL_INTERNAL_SECRET = process.env.PAYMENT_PORTAL_INTERNAL_SECRET;

const VSE_BACKEND_URL = process.env.VSE_BACKEND_URL || `http://localhost:${process.env.PORT || 8787}`;

if (!PAYMENT_PORTAL_INTERNAL_SECRET) {
    throw new Error('PAYMENT_PORTAL_INTERNAL_SECRET is not set — must match vse-backend\'s value.');
}

// Enhanced security headers with Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'none'"],
            frameSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
}));

// Additional security headers
app.use((req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Control caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    // Prevent search engines from indexing
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    // Add request ID for tracking
    res.setHeader('X-Request-ID', crypto.randomUUID());
    next();
});

app.use(express.json({ limit: '1mb' })); // Reduced from 2mb to 1mb for security

// The desktop client talks over the custom `vscode-egypt://` protocol / a fixed
// localhost origin during dev. In production, the landing page (GitHub Pages) and
// payment portal (wherever it's hosted) also need to be allowed — set CORS_ORIGIN
// to a comma-separated list of their real origins, e.g.:
//   CORS_ORIGIN=https://yourname.github.io,https://vse-payment-portal.up.railway.app
const envOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

const allowedOrigins = [
    'vscode-egypt://app',
    'http://localhost:3000', // dev only
    'http://localhost:4000', // vse-payment-portal, local dev
    'http://localhost:5000', // vse-landing, local dev
    ...envOrigins,
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    },
}));

const limiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
    max: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 30),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'rate_limited', message: 'Too many requests — slow down.' },
    keyGenerator: (req) => {
        // Use IP + user agent for more accurate rate limiting
        return `${req.ip}-${req.headers['user-agent'] || 'unknown'}`;
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/healthz';
    },
});
app.use('/v1', limiter);

// Auth endpoints get a tighter limit than the general API — this is where
// credential stuffing / OTP-spam abuse actually happens.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'rate_limited', message: 'Too many auth attempts — try again later.' },
    keyGenerator: (req) => {
        // Use IP + email combination for more accurate rate limiting
        const email = req.body?.email || 'unknown';
        return `${req.ip}-${email}`;
    },
});
app.use('/v1/auth', authLimiter);

// Security audit logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.headers['user-agent'] || 'unknown',
        };
        
        // Log security-relevant events
        if (res.statusCode >= 400) {
            console.error('[SECURITY]', JSON.stringify(logData));
        } else if (req.path.includes('/admin') || req.path.includes('/auth')) {
            console.log('[AUDIT]', JSON.stringify(logData));
        }
    });
    next();
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Security info endpoint (for monitoring)
app.get('/security-info', (req, res) => {
    res.json({
        server: 'VS Code Egypt Backend',
        version: '1.0.0',
        security: {
            rateLimiting: 'enabled',
            cors: 'enabled',
            helmet: 'enabled',
            authentication: 'JWT + bcrypt',
            adminAuth: 'separate session system',
        },
    });
});

app.use('/v1/auth', authRoutes);

// /v1/license/verify is intentionally NOT behind requireValidLicense (it IS the
// license check). /v1/topup/confirm authenticates via its own internal-secret
// check instead of a user Bearer token (it's called server-to-server by the
// payment portal, not by a signed-in IDE client). /v1/payment has its own mixed
// auth per-route too: /request is public (anyone can claim a transfer),
// /admin/* is gated by requireAdminSession (middleware/adminAuth.js) — a
// completely separate session system from customer login, not the license JWT
// this general gate checks. All three must be registered BEFORE the general
// '/v1' gate below, since Express matches app.use() prefixes in registration
// order: a request to /v1/topup/... matches '/v1' just as much as it matches
// '/v1/topup', so whichever is registered first wins.
app.use('/v1/license', licenseRoutes);
app.use('/v1/topup', topupRoutes);
app.use('/v1/payment', paymentRoutes);
app.use('/v1', requireValidLicense, chatRoutes);
app.use('/v1/billing', requireValidLicense, billingRoutes);
app.use('/v1/workspace', requireValidLicense, workspaceRoutes);
app.use('/v1/agent', requireValidLicense, agentRoutes);

// ---------- Payment Portal Pages ----------
// Injected server-side so the backend URL and payment channel details never
// appear in the static bundle committed to the public repo.

const PAYMENT_CHANNELS = {
    instapay: process.env.INSTAPAY_HANDLE ? { 'InstaPay Handle': process.env.INSTAPAY_HANDLE } : null,
    vodafone_cash: process.env.VODAFONE_CASH_NUMBER ? { 'Vodafone Cash / Bank Misr Wallet': process.env.VODAFONE_CASH_NUMBER } : null,
    paypal: process.env.PAYPAL_EMAIL ? { 'PayPal Email': process.env.PAYPAL_EMAIL } : null,
    crypto: process.env.CRYPTO_USDT_TRC20_ADDRESS ? { 'USDT (TRC20) Address': process.env.CRYPTO_USDT_TRC20_ADDRESS } : null,
};

app.get('/dashboard/billing', (_req, res) => {
    const filePath = path.join(PAYMENT_PORTAL_PUBLIC, 'billing.html');
    if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
    const html = fs.readFileSync(filePath, 'utf8');
    const injected = html.replace(
        '</head>',
        `<script>window.__VSE_BACKEND_URL__ = ${JSON.stringify(VSE_BACKEND_URL)};</script></head>`
    );
    res.type('html').send(injected);
});

app.get('/manual-payment', (_req, res) => {
    const filePath = path.join(PAYMENT_PORTAL_PUBLIC, 'manual-payment.html');
    if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
    const html = fs.readFileSync(filePath, 'utf8');
    const injected = html.replace(
        '</head>',
        `<script>
            window.__VSE_BACKEND_URL__ = ${JSON.stringify(VSE_BACKEND_URL)};
            window.__VSE_PAYMENT_CHANNELS__ = ${JSON.stringify(PAYMENT_CHANNELS)};
        </script></head>`
    );
    res.type('html').send(injected);
});

app.get('/support', (_req, res) => {
    const filePath = path.join(PAYMENT_PORTAL_PUBLIC, 'support.html');
    if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
    res.sendFile(filePath);
});

// ---------- Payment Portal Checkout ----------
const PLAN_CATALOG = {
    pro_monthly: { type: 'subscription', plan: 'pro', durationDays: 30, priceEGP: 499 },
    pro_yearly: { type: 'subscription', plan: 'pro', durationDays: 365, priceEGP: 4990 },
    team_monthly: { type: 'subscription', plan: 'team', durationDays: 30, priceEGP: 1499 },
    team_yearly: { type: 'subscription', plan: 'team', durationDays: 365, priceEGP: 14990 },
};

const TOPUP_CATALOG = {
    topup_100: { type: 'topup', amountEgp: 100 },
    topup_200: { type: 'topup', amountEgp: 200 },
    topup_400: { type: 'topup', amountEgp: 400 },
    topup_800: { type: 'topup', amountEgp: 800 },
    topup_1000: { type: 'topup', amountEgp: 1000 },
};

const CATALOG = { ...PLAN_CATALOG, ...TOPUP_CATALOG };

function simulateGatewayConfirmation(method, amountEGP) {
    return {
        success: true,
        paymentRef: `${method}_${crypto.randomUUID()}`,
        amountEGP,
    };
}

async function issueLicense(userId, plan, durationDays, paymentRef) {
    const response = await fetch(`${VSE_BACKEND_URL}/v1/license/issue`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': PAYMENT_PORTAL_INTERNAL_SECRET,
        },
        body: JSON.stringify({ userId, plan, durationDays, paymentRef }),
    });
    if (!response.ok) throw new Error(`license issue failed: ${response.status}`);
    return response.json();
}

async function confirmTopup(userId, amountEgp, paymentRef) {
    const response = await fetch(`${VSE_BACKEND_URL}/v1/topup/confirm`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': PAYMENT_PORTAL_INTERNAL_SECRET,
        },
        body: JSON.stringify({ userId, amountEgp, paymentRef }),
    });
    if (!response.ok) throw new Error(`topup confirm failed: ${response.status}`);
    return response.json();
}

app.post('/checkout/vodafone-cash', async (req, res) => {
    const { userId, sku, phoneNumber } = req.body || {};
    const item = CATALOG[sku];
    if (!userId || !item || !phoneNumber) return res.status(400).json({ error: 'invalid_request' });
    if (!/^01[0125][0-9]{8}$/.test(phoneNumber)) {
        return res.status(400).json({ error: 'invalid_phone', message: 'اكتب رقم موبايل مصري صحيح.' });
    }
    try {
        const priceEGP = item.type === 'topup' ? item.amountEgp : item.priceEGP;
        const confirmation = simulateGatewayConfirmation('vodafone_cash', priceEGP);
        if (!confirmation.success) return res.status(402).json({ error: 'payment_declined' });
        if (item.type === 'topup') {
            const result = await confirmTopup(userId, item.amountEgp, confirmation.paymentRef);
            return res.json({ success: true, topup: result });
        }
        const license = await issueLicense(userId, item.plan, item.durationDays, confirmation.paymentRef);
        return res.json({ success: true, license });
    } catch (err) {
        console.error('[checkout] vodafone-cash error:', err);
        return res.status(502).json({ error: 'checkout_failed' });
    }
});

app.post('/checkout/meeza', async (req, res) => {
    const { userId, sku, cardLast4 } = req.body || {};
    const item = CATALOG[sku];
    if (!userId || !item || !cardLast4) return res.status(400).json({ error: 'invalid_request' });
    try {
        const priceEGP = item.type === 'topup' ? item.amountEgp : item.priceEGP;
        const confirmation = simulateGatewayConfirmation('meeza', priceEGP);
        if (!confirmation.success) return res.status(402).json({ error: 'payment_declined' });
        if (item.type === 'topup') {
            const result = await confirmTopup(userId, item.amountEgp, confirmation.paymentRef);
            return res.json({ success: true, topup: result });
        }
        const license = await issueLicense(userId, item.plan, item.durationDays, confirmation.paymentRef);
        return res.json({ success: true, license });
    } catch (err) {
        console.error('[checkout] meeza error:', err);
        return res.status(502).json({ error: 'checkout_failed' });
    }
});

// ---------- Payment Portal Static Files ----------
// Served AFTER the injected routes above so /dashboard/billing etc. take priority
// over the plain static files.
app.use(express.static(PAYMENT_PORTAL_PUBLIC));

app.use((err, req, res, next) => {
    if (err && err.message === 'Not allowed by CORS') {
        // Expected, routine rejection — not a server bug. Logging this at error
        // level would spam the log with every blocked cross-origin probe.
        return res.status(403).json({ error: 'origin_not_allowed' });
    }
    console.error('[vse-backend] unhandled error:', err);
    res.status(500).json({ error: 'internal_error' });
});

// Railway (and most PaaS platforms) inject their own PORT at runtime — this env var
// is already read correctly for that. The `|| 8787` fallback only matters for local
// dev without Railway, and is kept at 8787 (not 4000) to match every other doc,
// script, and .env.example in this project — vse-payment-portal is what runs on
// 4000, not this backend.
const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
    console.log(`[vse-backend] listening on :${PORT}`);
});
