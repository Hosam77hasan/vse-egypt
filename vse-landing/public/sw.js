// sw.js — service worker for the hidden admin PWA (admin.html).
//
// Handles Web Push notifications for new manual payment requests, including
// showing them while the browser/tab is CLOSED. This is the whole point of
// a service worker — a page-level Notification API call only works while the
// tab is open, but a service worker's push listener fires regardless.
//
// Registered by admin.js ONLY after a successful passcode login — no one
// triggers a permission prompt or subscription without authenticating first.

// ═══════════════════════════════════════════════════════════════
// Install & Activate — take control immediately
// ═══════════════════════════════════════════════════════════════
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ═══════════════════════════════════════════════════════════════
// Push event — fired even when the browser/phone is closed
// ═══════════════════════════════════════════════════════════════
self.addEventListener('push', (event) => {
  let payload = {
    title: '📥 طلب شحن جديد!',
    body: 'في طلب شحن رصيد جديد ينتظر المراجعة.',
    tag: 'new-payment',
    requireInteraction: true,
    data: { url: 'admin.html' },
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    // Non-JSON push payload — fall back to the default text above.
  }

  const options = {
    body: payload.body,
    tag: payload.tag || 'new-payment',
    requireInteraction: payload.requireInteraction !== false,
    data: payload.data || { url: 'admin.html' },
    // 'silent: false' ensures the OS default alert sound plays — the closest
    // web push gets to a "custom sound tag" since the Web Notifications API
    // doesn't support custom notification sounds.
    silent: false,
    // Badge icon for Android/macOS (shows in status bar / dock)
    badge: 'assets/kliopatra.png',
    icon: 'assets/kliopatra.png',
    // Vibration pattern for Android (vibrate, pause, vibrate — in ms)
    vibrate: [200, 100, 200, 100, 400],
    // Actions for quick approve/reject (shown on Android, may not work on all platforms)
    actions: [
      { action: 'open', title: '🔍 فتح الطلب' },
    ],
    // Re-notify even if the same tag is already showing
    renotify: true,
    // Timestamp for ordering
    timestamp: Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// ═══════════════════════════════════════════════════════════════
// Notification click — open/focus admin dashboard
// ═══════════════════════════════════════════════════════════════
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || 'admin.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Find an existing admin.html window/tab and focus it
      for (const client of clients) {
        if (client.url.includes('admin.html') && 'focus' in client) {
          // Navigate to the specific request if the notification had one
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // No existing admin tab — open a new one
      return self.clients.openWindow(targetUrl);
    })
  );
});
