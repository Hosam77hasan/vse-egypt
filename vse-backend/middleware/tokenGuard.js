const db = require('../db');

const PLAN_LIMITS = {
    free: Number(process.env.PLAN_FREE_MONTHLY_TOKENS || 0),
    pro: Number(process.env.PLAN_PRO_MONTHLY_TOKENS || 2_000_000),
    team: Number(process.env.PLAN_TEAM_MONTHLY_TOKENS || 8_000_000),
};

function currentPeriod() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Blocks the request BEFORE it hits the provider if the user is over quota — checking
 * BOTH the monthly plan allowance AND the prepaid credit wallet (topped up via Vodafone
 * Cash / any wallet, see routes/topup.js). The plan allowance resets every period;
 * credit does not — it's spent once and stays spent until the user tops up again,
 * which is exactly how prepaid mobile credit works, deliberately mirroring that.
 */
function requireTokenBudget(req, res, next) {
    const period = currentPeriod();
    const row = db.prepare(
        'SELECT prompt_tokens, completion_tokens FROM token_usage WHERE user_id = ? AND period_month = ?'
    ).get(req.user.id, period);
    const used = row ? row.prompt_tokens + row.completion_tokens : 0;
    const limit = PLAN_LIMITS[req.user.plan] ?? 0;

    const user = db.prepare('SELECT credit_balance_tokens, credit_consumed_tokens FROM users WHERE id = ?').get(req.user.id);
    const availableCredit = Math.max(0, (user?.credit_balance_tokens ?? 0) - (user?.credit_consumed_tokens ?? 0));

    const planExhausted = used >= limit;
    if (planExhausted && availableCredit <= 0) {
        return res.status(429).json({
            error: 'token_quota_exceeded',
            message: 'Monthly AI token allowance and prepaid credit are both used up. Top up or wait for next billing cycle.',
            used,
            limit,
            availableCredit,
        });
    }

    // If the plan's monthly allowance is already exhausted but credit is available,
    // this request draws from credit — recordUsage() below needs to know that so it
    // deducts from the wallet instead of (only) the monthly counters.
    req.tokenBudget = { used, limit, period, usingCredit: planExhausted, availableCredit };
    next();
}

/** Call after a provider response completes to record actual usage (aggregate + per-model breakdown + credit deduction if applicable). */
function recordUsage(userId, period, promptTokens, completionTokens, modelAlias = 'driver', usingCredit = false) {
    db.prepare(`
        INSERT INTO token_usage (user_id, period_month, prompt_tokens, completion_tokens, request_count, updated_at)
        VALUES (?, ?, ?, ?, 1, datetime('now'))
        ON CONFLICT(user_id, period_month) DO UPDATE SET
            prompt_tokens = prompt_tokens + excluded.prompt_tokens,
            completion_tokens = completion_tokens + excluded.completion_tokens,
            request_count = request_count + 1,
            updated_at = datetime('now')
    `).run(userId, period, promptTokens, completionTokens);

    db.prepare(`
        INSERT INTO token_usage_by_model (user_id, period_month, model_alias, prompt_tokens, completion_tokens, request_count, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
        ON CONFLICT(user_id, period_month, model_alias) DO UPDATE SET
            prompt_tokens = prompt_tokens + excluded.prompt_tokens,
            completion_tokens = completion_tokens + excluded.completion_tokens,
            request_count = request_count + 1,
            updated_at = datetime('now')
    `).run(userId, period, modelAlias, promptTokens, completionTokens);

    if (usingCredit) {
        db.prepare('UPDATE users SET credit_consumed_tokens = credit_consumed_tokens + ? WHERE id = ?')
            .run(promptTokens + completionTokens, userId);
    }
}

module.exports = { requireTokenBudget, recordUsage, PLAN_LIMITS };
