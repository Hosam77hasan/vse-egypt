const express = require('express');
const db = require('../db');
const { PLAN_LIMITS } = require('../middleware/tokenGuard');
const { getPublicCatalog } = require('../config/models');

const router = express.Router();

function currentPeriod() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * GET /v1/billing/summary
 * Requires the same Bearer auth as /v1/chat (requireValidLicense, mounted in server.js).
 * Powers vse-payment-portal's /dashboard/billing page.
 */
router.get('/summary', (req, res) => {
    const period = currentPeriod();

    const user = db.prepare('SELECT id, email, plan, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'not_found' });
    }

    const aggregate = db.prepare(
        'SELECT prompt_tokens, completion_tokens, request_count FROM token_usage WHERE user_id = ? AND period_month = ?'
    ).get(user.id, period) || { prompt_tokens: 0, completion_tokens: 0, request_count: 0 };

    const byModel = db.prepare(
        'SELECT model_alias, prompt_tokens, completion_tokens, request_count FROM token_usage_by_model WHERE user_id = ? AND period_month = ?'
    ).all(user.id, period);

    const activeLicense = db.prepare(
        `SELECT expires_at, payment_ref FROM licenses WHERE user_id = ? AND status = 'active' ORDER BY expires_at DESC LIMIT 1`
    ).get(user.id);

    const usedTokens = aggregate.prompt_tokens + aggregate.completion_tokens;
    const limitTokens = PLAN_LIMITS[user.plan] ?? 0;

    res.json({
        email: user.email,
        plan: user.plan,
        period,
        usage: {
            promptTokens: aggregate.prompt_tokens,
            completionTokens: aggregate.completion_tokens,
            totalTokens: usedTokens,
            requestCount: aggregate.request_count,
            limitTokens,
            percentUsed: limitTokens > 0 ? Math.min(100, Math.round((usedTokens / limitTokens) * 100)) : (usedTokens > 0 ? 100 : 0),
            byModel: byModel.map(m => ({
                model: m.model_alias,
                label: getPublicCatalog()[m.model_alias]?.label ?? m.model_alias,
                totalTokens: m.prompt_tokens + m.completion_tokens,
                requestCount: m.request_count,
            })),
        },
        subscription: activeLicense
            ? { expiresAt: activeLicense.expires_at, paymentRef: activeLicense.payment_ref }
            : null,
    });
});

module.exports = router;
