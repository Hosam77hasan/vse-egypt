const express = require('express');
const db = require('../db');

const router = express.Router();

// EGP -> tokens granted. Linear (2,000 tokens per EGP) so the ladder is predictable —
// deliberately simple and easy to explain to someone recharging like they would
// mobile credit, not a marketing-driven curve with bigger discounts at higher tiers.
const TOPUP_CATALOG = {
	100: 200_000,
	200: 400_000,
	400: 800_000,
	800: 1_600_000,
	1000: 2_000_000,
};

/**
 * POST /v1/topup/confirm
 * INTERNAL ONLY — same trust boundary as /v1/license/issue: must sit behind a
 * network boundary or service-to-service secret, never exposed to the public
 * internet as-is. Called by vse-payment-portal's server AFTER it has confirmed a
 * transaction with the payment gateway webhook — never on the client's say-so.
 */
router.post('/confirm', (req, res) => {
	const internalSecret = req.headers['x-internal-secret'];
	if (!internalSecret || internalSecret !== process.env.PAYMENT_PORTAL_INTERNAL_SECRET) {
		return res.status(403).json({ error: 'forbidden' });
	}

	const { userId, amountEgp, paymentRef } = req.body || {};
	const tokensGranted = TOPUP_CATALOG[Number(amountEgp)];

	if (!userId || !tokensGranted || !paymentRef) {
		return res.status(400).json({ error: 'invalid_request', message: `amountEgp must be one of: ${Object.keys(TOPUP_CATALOG).join(', ')}` });
	}

	const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
	if (!user) {
		return res.status(404).json({ error: 'user_not_found' });
	}

	db.prepare('UPDATE users SET credit_balance_tokens = credit_balance_tokens + ? WHERE id = ?').run(tokensGranted, userId);
	db.prepare('INSERT INTO topups (user_id, amount_egp, tokens_granted, payment_ref) VALUES (?, ?, ?, ?)').run(userId, amountEgp, tokensGranted, paymentRef);

	const updated = db.prepare('SELECT credit_balance_tokens, credit_consumed_tokens FROM users WHERE id = ?').get(userId);
	res.json({
		topped_up: true,
		tokensGranted,
		newBalance: updated.credit_balance_tokens - updated.credit_consumed_tokens,
	});
});

/** GET /v1/topup/catalog — public list of valid amounts, used by the portal UI. */
router.get('/catalog', (_req, res) => {
	res.json({ amounts: Object.entries(TOPUP_CATALOG).map(([egp, tokens]) => ({ amountEgp: Number(egp), tokensGranted: tokens })) });
});

module.exports = router;
