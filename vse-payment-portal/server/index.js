require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

const VSE_BACKEND_URL = process.env.VSE_BACKEND_URL || 'http://localhost:8787';
const PAYMENT_PORTAL_INTERNAL_SECRET = process.env.PAYMENT_PORTAL_INTERNAL_SECRET;

if (!PAYMENT_PORTAL_INTERNAL_SECRET) {
    throw new Error('PAYMENT_PORTAL_INTERNAL_SECRET is not set — must match vse-backend\'s value.');
}

// /dashboard/billing per the spec'd path — served explicitly (ahead of the static
// handler below) so the backend URL can be injected server-side rather than
// hardcoded in the client bundle.
app.get('/dashboard/billing', (_req, res) => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'billing.html'), 'utf8');
    const injected = html.replace(
        '</head>',
        `<script>window.__VSE_BACKEND_URL__ = ${JSON.stringify(VSE_BACKEND_URL)};</script></head>`
    );
    res.type('html').send(injected);
});

// Manual payment channels (InstaPay/Vodafone Cash/PayPal/crypto) — real
// handles/addresses come from env vars so they're never hardcoded into the
// static bundle. Empty by default; fill in .env before deploying, or the
// page will show "not available" for whichever channel is unset.
const PAYMENT_CHANNELS = {
    instapay: process.env.INSTAPAY_HANDLE ? { 'InstaPay Handle': process.env.INSTAPAY_HANDLE } : null,
    vodafone_cash: process.env.VODAFONE_CASH_NUMBER ? { 'Vodafone Cash / Bank Misr Wallet': process.env.VODAFONE_CASH_NUMBER } : null,
    paypal: process.env.PAYPAL_EMAIL ? { 'PayPal Email': process.env.PAYPAL_EMAIL } : null,
    crypto: process.env.CRYPTO_USDT_TRC20_ADDRESS ? { 'USDT (TRC20) Address': process.env.CRYPTO_USDT_TRC20_ADDRESS } : null,
};

// /manual-payment per the spec'd manual payment portal — served explicitly
// (ahead of the static handler below) so both the backend URL and the payment
// channel details are injected server-side, same reasoning as /dashboard/billing.
app.get('/manual-payment', (_req, res) => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'manual-payment.html'), 'utf8');
    const injected = html.replace(
        '</head>',
        `<script>
            window.__VSE_BACKEND_URL__ = ${JSON.stringify(VSE_BACKEND_URL)};
            window.__VSE_PAYMENT_CHANNELS__ = ${JSON.stringify(PAYMENT_CHANNELS)};
        </script></head>`
    );
    res.type('html').send(injected);
});

app.use(express.static(path.join(__dirname, '..', 'public')));

const PLAN_CATALOG = {
    pro_monthly: { type: 'subscription', plan: 'pro', durationDays: 30, priceEGP: 499 },
    pro_yearly: { type: 'subscription', plan: 'pro', durationDays: 365, priceEGP: 4990 },
    team_monthly: { type: 'subscription', plan: 'team', durationDays: 30, priceEGP: 1499 },
    team_yearly: { type: 'subscription', plan: 'team', durationDays: 365, priceEGP: 14990 },
};

// Prepaid credit top-ups — for anyone without a bank card who wants to pay small,
// flexible amounts via Vodafone Cash or any e-wallet, same way people top up mobile
// credit. 100 EGP as the floor, doubling from there: 100/200/400/800/1000.
const TOPUP_CATALOG = {
    topup_100: { type: 'topup', amountEgp: 100 },
    topup_200: { type: 'topup', amountEgp: 200 },
    topup_400: { type: 'topup', amountEgp: 400 },
    topup_800: { type: 'topup', amountEgp: 800 },
    topup_1000: { type: 'topup', amountEgp: 1000 },
};

const CATALOG = { ...PLAN_CATALOG, ...TOPUP_CATALOG };

/**
 * POST /checkout/vodafone-cash
 * Body: { userId, sku, phoneNumber }
 *
 * =========================== SIMULATION NOTICE ===========================
 * This does NOT call a real Vodafone Cash merchant API. Vodafone Cash's real
 * integration requires a registered merchant account, a signed agreement,
 * and their actual USSD/API confirmation flow (OTP push to the customer's
 * phone, merchant callback webhook, etc.) — none of which exist in this
 * scaffold. Swap `simulateGatewayConfirmation()` for a real call to
 * Vodafone's merchant API once you have those credentials.
 * ===========================================================================
 */
app.post('/checkout/vodafone-cash', async (req, res) => {
    const { userId, sku, phoneNumber } = req.body || {};
    const item = CATALOG[sku];

    if (!userId || !item || !phoneNumber) {
        return res.status(400).json({ error: 'invalid_request' });
    }
    if (!/^01[0125][0-9]{8}$/.test(phoneNumber)) {
        return res.status(400).json({ error: 'invalid_phone', message: 'اكتب رقم موبايل مصري صحيح.' });
    }

    try {
        const priceEGP = item.type === 'topup' ? item.amountEgp : item.priceEGP;
        const confirmation = await simulateGatewayConfirmation('vodafone_cash', priceEGP);
        if (!confirmation.success) {
            return res.status(402).json({ error: 'payment_declined' });
        }

        if (item.type === 'topup') {
            const result = await confirmTopup(userId, item.amountEgp, confirmation.paymentRef);
            return res.json({ success: true, topup: result });
        }
        const license = await issueLicense(userId, item.plan, item.durationDays, confirmation.paymentRef);
        return res.json({ success: true, license });
    } catch (err) {
        console.error('[vse-payment-portal] vodafone-cash checkout error:', err);
        return res.status(502).json({ error: 'checkout_failed' });
    }
});

/**
 * POST /checkout/meeza
 * Body: { userId, sku, cardLast4 }
 *
 * =========================== SIMULATION NOTICE ===========================
 * Same as above — real Meeza card acceptance goes through an EMV-compliant
 * payment gateway (e.g. a licensed Egyptian acquirer), not this endpoint.
 * Card numbers must NEVER touch this server directly in a real deployment —
 * use the gateway's hosted checkout / tokenization so raw PAN never hits
 * your infrastructure (PCI-DSS scope reduction). This mock only ever
 * receives the last 4 digits for display purposes.
 * ===========================================================================
 */
app.post('/checkout/meeza', async (req, res) => {
    const { userId, sku, cardLast4 } = req.body || {};
    const item = CATALOG[sku];

    if (!userId || !item || !cardLast4) {
        return res.status(400).json({ error: 'invalid_request' });
    }

    try {
        const priceEGP = item.type === 'topup' ? item.amountEgp : item.priceEGP;
        const confirmation = await simulateGatewayConfirmation('meeza', priceEGP);
        if (!confirmation.success) {
            return res.status(402).json({ error: 'payment_declined' });
        }

        if (item.type === 'topup') {
            const result = await confirmTopup(userId, item.amountEgp, confirmation.paymentRef);
            return res.json({ success: true, topup: result });
        }
        const license = await issueLicense(userId, item.plan, item.durationDays, confirmation.paymentRef);
        return res.json({ success: true, license });
    } catch (err) {
        console.error('[vse-payment-portal] meeza checkout error:', err);
        return res.status(502).json({ error: 'checkout_failed' });
    }
});

/** Mock gateway call — replace with the real merchant SDK/API call. */
async function simulateGatewayConfirmation(method, amountEGP) {
    await new Promise(r => setTimeout(r, 400)); // simulate network round-trip
    return {
        success: true, // a real integration checks the gateway's actual response here
        paymentRef: `${method}_${crypto.randomUUID()}`,
        amountEGP,
    };
}

/** Calls vse-backend's internal-only license issuance endpoint. */
async function issueLicense(userId, plan, durationDays, paymentRef) {
    const response = await fetch(`${VSE_BACKEND_URL}/v1/license/issue`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': PAYMENT_PORTAL_INTERNAL_SECRET,
        },
        body: JSON.stringify({ userId, plan, durationDays, paymentRef }),
    });

    if (!response.ok) {
        throw new Error(`license issue failed: ${response.status}`);
    }
    return response.json(); // { token, expiresAt }
}

/** Calls vse-backend's internal-only credit top-up endpoint. */
async function confirmTopup(userId, amountEgp, paymentRef) {
    const response = await fetch(`${VSE_BACKEND_URL}/v1/topup/confirm`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': PAYMENT_PORTAL_INTERNAL_SECRET,
        },
        body: JSON.stringify({ userId, amountEgp, paymentRef }),
    });

    if (!response.ok) {
        throw new Error(`topup confirm failed: ${response.status}`);
    }
    return response.json(); // { tokensGranted, newBalance }
}

// Railway (and most PaaS platforms) inject their own PORT at runtime — read that
// first, same pattern as vse-backend/server.js. PAYMENT_PORTAL_PORT is kept as a
// fallback so existing local-dev .env files using that name keep working unchanged.
const PORT = process.env.PORT || process.env.PAYMENT_PORTAL_PORT || 4000;
app.listen(PORT, () => console.log(`[vse-payment-portal] listening on :${PORT}`));
