// Clean Architecture payment switcher. routes/payment.js depends only on this
// module's interface (createRequest / listByStatus / getById / approve / reject),
// never on ManualPaymentProvider or AutomatedPaymentProvider directly — so
// flipping PAYMENT_MODE is the entire migration when a real gateway is ready.
const manual = require('./ManualPaymentProvider');
const automated = require('./AutomatedPaymentProvider');

const PAYMENT_MODE = process.env.PAYMENT_MODE || 'manual';

const providers = { manual, automated };

if (!providers[PAYMENT_MODE]) {
    throw new Error(`Unknown PAYMENT_MODE "${PAYMENT_MODE}" — expected "manual" or "automated".`);
}

console.log(`[vse-backend/payment] active provider: ${PAYMENT_MODE}`);

module.exports = providers[PAYMENT_MODE];
