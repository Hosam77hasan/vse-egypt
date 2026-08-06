/**
 * AutomatedPaymentProvider — placeholder sibling of ManualPaymentProvider.js in
 * the Clean Architecture payment switcher (see ./index.js).
 *
 * vse-payment-portal/server/index.js already has a *real* (simulated) automated
 * checkout flow of its own — /checkout/vodafone-cash and /checkout/meeza, which
 * call vse-backend's /v1/topup/confirm and /v1/license/issue directly. This file
 * does NOT replace that. It exists so routes/payment.js has a second
 * implementation of the SAME interface as ManualPaymentProvider (createRequest /
 * listByStatus / getById / approve / reject) to switch to via PAYMENT_MODE=automated
 * later, if the manual review queue here (payment_requests) is ever wired up to
 * a real gateway webhook instead of a human admin.
 *
 * Until a real gateway integration exists, every method below throws rather than
 * silently no-opping — PAYMENT_MODE defaults to 'manual' (see .env.example) and
 * should stay there until this is actually implemented against a merchant API.
 */

function notImplemented(method) {
    throw new Error(
        `AutomatedPaymentProvider.${method}() is not implemented. ` +
        `Set PAYMENT_MODE=manual (the default) until a real gateway integration lands here.`
    );
}

module.exports = {
    createRequest: () => notImplemented('createRequest'),
    listByStatus: () => notImplemented('listByStatus'),
    getById: () => notImplemented('getById'),
    approve: () => notImplemented('approve'),
    reject: () => notImplemented('reject'),
};
