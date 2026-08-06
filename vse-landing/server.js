const express = require('express');
const path = require('path');

const app = express();
const PAYMENT_PORTAL_URL = process.env.PAYMENT_PORTAL_URL || 'http://localhost:4000';

app.use(express.static(path.join(__dirname, 'public')));

// Pricing card CTAs on the landing page link here with ?sku=... — forward straight
// into vse-payment-portal's plan pre-selection rather than duplicating checkout logic.
app.get('/checkout', (req, res) => {
    const sku = req.query.sku;
    const target = sku
        ? `${PAYMENT_PORTAL_URL}/?sku=${encodeURIComponent(sku)}`
        : PAYMENT_PORTAL_URL;
    res.redirect(302, target);
});

// Same forwarding pattern as /checkout — the support/FAQ page lives on the
// payment portal (vse-payment-portal/public/support.html), not duplicated here.
app.get('/support', (_req, res) => {
    res.redirect(302, `${PAYMENT_PORTAL_URL}/support.html`);
});

const PORT = process.env.LANDING_PORT || 5000;
app.listen(PORT, () => console.log(`[vse-landing] listening on :${PORT}`));
