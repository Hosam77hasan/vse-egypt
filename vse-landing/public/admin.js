(function () {
  const BACKEND_URL = (window.VSE_CONFIG && window.VSE_CONFIG.backendUrl) || 'http://localhost:8787';
  const SESSION_KEY = 'vseAdminToken';

  const loginGateEl = document.getElementById('loginGate');
  const dashboardEl = document.getElementById('dashboard');
  const listContainerEl = document.getElementById('listContainer');
  const pushBannerEl = document.getElementById('pushBanner');

  const token = sessionStorage.getItem(SESSION_KEY);
  if (!token) {
    loginGateEl.hidden = false;
    return;
  }
  dashboardEl.hidden = false;

  let currentStatus = 'pending';

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem(SESSION_KEY);
    location.href = 'index.html';
  });

  document.querySelectorAll('.status-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentStatus = tab.dataset.status;
      loadRequests();
    });
  });

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers: { ...(options.headers || {}), 'Authorization': `Bearer ${token}` },
    });
    if (res.status === 403) {
      // Session expired or was never valid — clear it and force a re-login rather
      // than showing a confusing empty dashboard.
      sessionStorage.removeItem(SESSION_KEY);
      loginGateEl.hidden = false;
      dashboardEl.hidden = true;
      throw new Error('session_expired');
    }
    return res;
  }

  const METHOD_LABELS = { instapay: 'InstaPay', vodafone_cash: 'فودافون كاش', paypal: 'PayPal', crypto: 'USDT' };

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderCard(req) {
    const highlightId = location.hash === `#request-${req.id}` ? 'highlight' : '';
    const actionsHtml = req.status === 'pending'
      ? `<div class="request-actions">
           <button class="btn-approve" data-action="approve" data-id="${req.id}">✅ موافقة</button>
           <button class="btn-reject" data-action="reject" data-id="${req.id}">❌ رفض</button>
         </div>`
      : `<span class="status-pill ${req.status}">${req.status === 'approved' ? 'تمت الموافقة' : 'مرفوض'}</span>`;

    return `
      <div class="request-card ${highlightId}" id="request-${req.id}">
        <div class="request-amount">${req.amount} ${req.currency}</div>
        <div class="request-row"><span>الإيميل</span><strong>${escapeHtml(req.email)}</strong></div>
        <div class="request-row"><span>الوسيلة</span><strong>${METHOD_LABELS[req.payment_method] || req.payment_method}</strong></div>
        <div class="request-row"><span>المرجع</span><strong>${escapeHtml(req.transaction_ref)}</strong></div>
        <div class="request-row"><span>التوكنز</span><strong>${req.tokens_requested.toLocaleString()}</strong></div>
        ${req.notes ? `<div class="request-row"><span>ملاحظات</span><strong>${escapeHtml(req.notes)}</strong></div>` : ''}
        <div class="request-row"><span>التاريخ</span><strong>${new Date(req.created_at).toLocaleString('ar-EG')}</strong></div>
        ${actionsHtml}
      </div>
    `;
  }

  async function loadRequests() {
    listContainerEl.innerHTML = '<div class="loading-state">جاري التحميل…</div>';
    try {
      const res = await apiFetch(`/v1/payment/admin/requests?status=${currentStatus}`);
      const data = await res.json();

      if (!data.requests || data.requests.length === 0) {
        listContainerEl.innerHTML = '<div class="empty-state">مفيش طلبات هنا دلوقتي.</div>';
        return;
      }

      listContainerEl.innerHTML = data.requests.map(renderCard).join('');

      listContainerEl.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset.id));
      });

      if (location.hash.startsWith('#request-')) {
        document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err) {
      if (err.message !== 'session_expired') {
        listContainerEl.innerHTML = '<div class="empty-state">تعذر تحميل الطلبات — حاول تاني.</div>';
      }
    }
  }

  async function handleAction(action, id) {
    const card = document.getElementById(`request-${id}`);
    const buttons = card.querySelectorAll('button');
    buttons.forEach(b => b.disabled = true);

    try {
      const res = await apiFetch(`/v1/payment/admin/requests/${id}/${action}`, { method: 'POST' });
      if (res.ok) {
        loadRequests();
      } else {
        buttons.forEach(b => b.disabled = false);
      }
    } catch {
      // session_expired already handled inside apiFetch (shows the login gate).
    }
  }

  // ---------- Web Push registration ----------
  // Only ever offered/triggered after a successful passcode login — see the
  // 'enablePushBtn' click handler below, never automatic on page load.
  async function offerPushIfSupported() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const registration = await navigator.serviceWorker.register('sw.js');
    const existing = await registration.pushManager.getSubscription();

    if (existing || Notification.permission === 'denied') return;
    pushBannerEl.hidden = false;

    document.getElementById('enablePushBtn').addEventListener('click', async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          pushBannerEl.hidden = true;
          return;
        }

        const vapidRes = await apiFetch('/v1/payment/admin/vapid-public-key').catch(() => null);
        // If the backend doesn't expose a public-key endpoint (older deployment),
        // push simply isn't available — fail quietly, the dashboard still works
        // fine via manual refresh.
        if (!vapidRes || !vapidRes.ok) { pushBannerEl.hidden = true; return; }
        const { publicKey } = await vapidRes.json();
        if (!publicKey) { pushBannerEl.hidden = true; return; }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        await apiFetch('/v1/payment/admin/subscribe-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        });

        pushBannerEl.hidden = true;
      } catch (err) {
        console.error('[admin] push subscription failed:', err);
        pushBannerEl.hidden = true;
      }
    });
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  loadRequests();
  offerPushIfSupported();
})();
