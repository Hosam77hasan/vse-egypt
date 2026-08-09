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
      sessionStorage.removeItem(SESSION_KEY);
      loginGateEl.hidden = false;
      dashboardEl.hidden = true;
      throw new Error('session_expired');
    }
    return res;
  }

  const METHOD_LABELS = {
    instapay: 'InstaPay',
    vodafone_cash: 'فودافون كاش',
    paypal: 'PayPal',
    crypto: 'USDT'
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /**
   * Builds the screenshot URL. Screenshots are served from the backend's
   * /uploads/payment-screenshots/ static path (mounted in server.js via
   * express.static). If screenshot_path is a relative DB path like
   * "/uploads/payment-screenshots/…", we strip the leading /uploads and
   * let apiFetch handle auth or just link directly.
   */
  function screenshotUrl(path) {
    if (!path) return null;
    // DB stores "/uploads/payment-screenshots/filename.png"
    return `${BACKEND_URL}${path}`;
  }

  function openLightbox(url) {
    const lb = document.createElement('div');
    lb.className = 'screenshot-lightbox';
    lb.innerHTML = '<img src="' + escapeHtml(url) + '" alt="صورة إثبات التحويل" />';
    lb.addEventListener('click', () => lb.remove());
    document.body.appendChild(lb);
  }

  function renderCard(req) {
    const highlightId = location.hash === `#request-${req.id}` ? 'highlight' : '';
    const reqId = escapeHtml(String(req.id));

    // ── Phone number row ──
    const phoneHtml = req.phone_number
      ? `<div class="request-row phone-row"><span>📱 رقم الهاتف</span><strong>${escapeHtml(req.phone_number)}</strong></div>`
      : '';

    // ── Screenshot image ──
    const screenshotSrc = screenshotUrl(req.screenshot_path);
    const screenshotHtml = screenshotSrc
      ? `<div class="request-screenshot">
           <span class="request-screenshot-label">📸 إثبات التحويل</span>
           <img src="${escapeHtml(screenshotSrc)}" alt="صورة التحويل" loading="lazy"
                onclick="event.stopPropagation(); (function(img){var d=document.createElement('div');d.className='screenshot-lightbox';d.innerHTML='<img src=\\''+img.src+'\\' />';d.onclick=function(){d.remove()};document.body.appendChild(d)})(this)" />
         </div>`
      : '';

    // ── Action buttons ──
    const actionsHtml = req.status === 'pending'
      ? `<div class="request-actions">
           <button class="btn-approve" data-action="approve" data-id="${reqId}">✅ موافقة وشحن التوكنز</button>
           <button class="btn-reject" data-action="reject" data-id="${reqId}">❌ رفض</button>
         </div>`
      : `<span class="status-pill ${req.status}">${req.status === 'approved' ? '✅ تمت الموافقة' : '❌ مرفوض'}</span>`;

    return `
      <div class="request-card ${highlightId}" id="request-${reqId}">
        <div class="request-amount">${req.amount} ${escapeHtml(req.currency)}</div>
        <div class="request-row"><span>📧 الإيميل</span><strong>${escapeHtml(req.email)}</strong></div>
        ${phoneHtml}
        <div class="request-row"><span>💳 الوسيلة</span><strong>${METHOD_LABELS[req.payment_method] || escapeHtml(req.payment_method)}</strong></div>
        <div class="request-row"><span>🧾 المرجع</span><strong>${escapeHtml(req.transaction_ref)}</strong></div>
        <div class="request-row"><span>🪙 التوكنز</span><strong>${(req.tokens_requested || 0).toLocaleString()}</strong></div>
        ${req.notes ? `<div class="request-row"><span>📝 ملاحظات</span><strong>${escapeHtml(req.notes)}</strong></div>` : ''}
        <div class="request-row"><span>📅 التاريخ</span><strong>${new Date(req.created_at).toLocaleString('ar-EG')}</strong></div>
        ${screenshotHtml}
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
        listContainerEl.innerHTML = '<div class="empty-state">📭 مفيش طلبات هنا دلوقتي.</div>';
        return;
      }

      listContainerEl.innerHTML = data.requests.map(renderCard).join('');

      listContainerEl.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset.id));
      });

      if (location.hash.startsWith('#request-')) {
        const el = document.getElementById(location.hash.slice(1));
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err) {
      if (err.message !== 'session_expired') {
        listContainerEl.innerHTML = '<div class="error-state">⚠️ تعذر تحميل الطلبات — تأكد من اتصال السيرفر وحاول تاني.</div>';
      }
    }
  }

  async function handleAction(action, id) {
    const card = document.getElementById('request-' + id);
    if (!card) return;

    const buttons = card.querySelectorAll('button');
    buttons.forEach(b => { b.disabled = true; b.textContent = 'جاري...'; });

    try {
      const res = await apiFetch('/v1/payment/admin/requests/' + id + '/' + action, { method: 'POST' });
      if (res.ok) {
        // Reload the list to reflect the change
        loadRequests();
      } else {
        const errData = await res.json().catch(() => ({}));
        buttons.forEach(b => {
          b.disabled = false;
          b.textContent = action === 'approve' ? '✅ موافقة وشحن التوكنز' : '❌ رفض';
        });
        if (errData.error === 'already_reviewed') {
          alert('تمت مراجعة الطلب ده قبل كده.');
        } else {
          alert('حصل خطأ — حاول تاني.');
        }
      }
    } catch {
      // session_expired is handled inside apiFetch
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Web Push Registration — PWA notifications
  // ═══════════════════════════════════════════════════════════════
  async function offerPushIfSupported() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      const registration = await navigator.serviceWorker.register('sw.js', { scope: '/' });

      // Wait for the SW to activate before checking subscription
      if (registration.installing) {
        await new Promise(resolve => {
          registration.installing.addEventListener('statechange', function f() {
            if (this.state === 'activated') { this.removeEventListener('statechange', f); resolve(); }
          });
        });
      }

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
    } catch (err) {
      console.error('[admin] service worker registration failed:', err);
    }
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
