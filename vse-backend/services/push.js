const webpush = require('web-push');
const db = require('../db');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

// Web Push is optional infrastructure — the manual-payment queue and admin panel
// both work fine over plain HTTP polling/refresh without it. Only fail loudly if
// someone actually tries to use it (register a subscription or send a
// notification) with the keys missing, rather than crashing server startup the
// way LICENSE_JWT_SECRET does for something load-bearing.
let configured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
} else {
    console.warn('[vse-backend/push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — admin push notifications are disabled. ' +
        'Generate a pair with `npx web-push generate-vapid-keys` and set them in .env.');
}

function saveSubscription(subscription) {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
        throw new Error('invalid_subscription');
    }
    db.prepare(`
        INSERT INTO admin_push_subscriptions (endpoint, p256dh, auth)
        VALUES (?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth
    `).run(subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
}

/**
 * Sends `payload` to every registered admin device. Prunes subscriptions the
 * push service reports as gone (410/404 — the browser unsubscribed or the
 * endpoint expired) so the table doesn't accumulate dead entries. Never throws
 * — a push failure should never break the request that triggered it (see
 * ManualPaymentProvider.createRequest, which calls this fire-and-forget).
 */
async function notifyAdmins(payload) {
    if (!configured) return;

    const subs = db.prepare('SELECT * FROM admin_push_subscriptions').all();
    if (subs.length === 0) return;

    const body = JSON.stringify(payload);

    await Promise.all(subs.map(async (sub) => {
        try {
            await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                body,
                { urgency: 'high' },
            );
        } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
                db.prepare('DELETE FROM admin_push_subscriptions WHERE id = ?').run(sub.id);
            } else {
                console.error('[vse-backend/push] send failed for subscription', sub.id, ':', err.message);
            }
        }
    }));
}

module.exports = {
    saveSubscription,
    notifyAdmins,
    isConfigured: () => configured,
    getPublicKey: () => (configured ? VAPID_PUBLIC_KEY : null),
};
