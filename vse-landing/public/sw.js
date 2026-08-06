// sw.js — service worker for the hidden admin PWA (admin.html). Handles Web Push
// notifications for new manual payment requests, including showing them while
// the browser/tab is closed (this is the whole point of a service worker here —
// a page-level Notification API call only works while the tab is open).
//
// Registered by admin.js, and ONLY by admin.js (after a successful passcode
// login) — this file itself has no gate, but nothing calls
// registration.pushManager.subscribe() until the admin is authenticated, so an
// unauthenticated visitor never triggers a permission prompt or a subscription.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: '📥 طلب شحن جديد!', body: 'في طلب شحن رصيد جديد ينتظر المراجعة.' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Non-JSON push payload — fall back to the default text above.
  }

  const options = {
    body: payload.body,
    tag: payload.tag || 'new-payment',
    requireInteraction: payload.requireInteraction !== false,
    data: payload.data || {},
    // Most platforms don't support a custom notification sound via the Web
    // Notifications API at all (it's a native-OS-level thing, not something
    // service workers control) — 'silent: false' just makes sure whatever the
    // OS default alert sound is actually plays, which is the closest web
    // push gets to a "custom sound tag".
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || 'admin.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('admin.html') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
