const db = require('../../db');
const { notifyAdmins } = require('../push');

/**
 * ManualPaymentProvider — the "manual" side of the Clean Architecture payment
 * switcher (see ./index.js). Nothing here talks to a real payment gateway; it
 * just queues a claimed transaction for a human admin to verify against their
 * own InstaPay/Vodafone Cash/PayPal/crypto account activity, then credits the
 * user's token wallet on approval. This is PAYMENT_MODE=manual (the default —
 * see .env.example) and is what routes/payment.js calls today.
 *
 * AutomatedPaymentProvider.js is the sibling for when a real gateway (Vodafone
 * Cash merchant API, a card processor, etc.) confirms transactions itself —
 * swap PAYMENT_MODE to point routes/payment.js at that instead, without
 * touching the route/table shape here.
 */

/**
 * @param {{ userId: number|null, email: string, amount: number, currency: 'EGP'|'USD',
 *   tokensRequested: number, paymentMethod: string, transactionRef: string, notes?: string }} data
 */
function createRequest(data) {
    const info = db.prepare(`
        INSERT INTO payment_requests
            (user_id, email, amount, currency, tokens_requested, payment_method, transaction_ref, phone_number, notes, screenshot_path, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
        data.userId ?? null,
        data.email,
        data.amount,
        data.currency,
        data.tokensRequested,
        data.paymentMethod,
        data.transactionRef,
        data.phoneNumber ?? null,
        data.notes ?? null,
        data.screenshotPath ?? null,
    );

    const request = db.prepare('SELECT * FROM payment_requests WHERE id = ?').get(info.lastInsertRowid);

    // Fire-and-forget — a slow/unreachable push endpoint should never block the
    // user's submission response. notifyAdmins already swallows/logs its own errors.
    notifyAdmins({
        title: '📥 طلب شحن جديد!',
        body: `مبلغ ${data.amount} ${data.currency} من ${data.email}${data.phoneNumber ? ' — ' + data.phoneNumber : ''}`,
        tag: 'new-payment',
        requireInteraction: true,
        data: { requestId: request.id, url: `/admin.html#request-${request.id}` },
    }).catch(err => console.error('[ManualPaymentProvider] push notify failed:', err.message));

    return request;
}

function listByStatus(status) {
    if (status) {
        return db.prepare('SELECT * FROM payment_requests WHERE status = ? ORDER BY created_at DESC').all(status);
    }
    return db.prepare('SELECT * FROM payment_requests ORDER BY created_at DESC').all();
}

function getById(id) {
    return db.prepare('SELECT * FROM payment_requests WHERE id = ?').get(id);
}

/**
 * Approves a pending request: credits the token wallet (if the request is tied
 * to a known user_id — a request submitted only by email with no matching
 * account still gets marked approved for the record, but there's no wallet to
 * credit) and marks it approved. Rejects if the request isn't currently pending
 * — approvals/rejections are one-way, never re-processed.
 */
function approve(id) {
    const request = getById(id);
    if (!request) return { ok: false, reason: 'not_found' };
    if (request.status !== 'pending') return { ok: false, reason: 'already_reviewed' };

    const applyApproval = db.transaction(() => {
        if (request.user_id) {
            db.prepare('UPDATE users SET credit_balance_tokens = credit_balance_tokens + ? WHERE id = ?')
                .run(request.tokens_requested, request.user_id);
        }
        db.prepare(`
            UPDATE payment_requests
            SET status = 'approved', reviewed_at = datetime('now'), updated_at = datetime('now')
            WHERE id = ?
        `).run(id);
    });
    applyApproval();

    return { ok: true, request: getById(id) };
}

function reject(id) {
    const request = getById(id);
    if (!request) return { ok: false, reason: 'not_found' };
    if (request.status !== 'pending') return { ok: false, reason: 'already_reviewed' };

    db.prepare(`
        UPDATE payment_requests
        SET status = 'rejected', reviewed_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
    `).run(id);

    return { ok: true, request: getById(id) };
}

module.exports = { createRequest, listByStatus, getById, approve, reject };
