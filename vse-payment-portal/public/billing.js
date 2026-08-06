(function () {
  const VSE_BACKEND_URL = window.__VSE_BACKEND_URL__ || 'http://localhost:8787';

  const token = new URLSearchParams(location.search).get('token');
  const loadingEl = document.getElementById('loadingState');
  const errorEl = document.getElementById('errorState');
  const contentEl = document.getElementById('content');

  function showError(message) {
    loadingEl.hidden = true;
    contentEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  if (!token) {
    // This page is only reachable with a valid access token appended by the desktop
    // app's "Upgrade / Billing" links (status bar entry, chat panel link) — there is
    // no separate portal login flow for it yet, see README's "still open" list.
    showError('رابط غير صالح — افتح صفحة الفواتير من داخل VS Code Egypt (شريط الحالة أو الشات).');
    return;
  }

  const PLAN_LABELS = { free: 'مجاني', pro: 'Pro', team: 'Team' };

  fetch(`${VSE_BACKEND_URL}/v1/billing/summary`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
    .then(async (res) => {
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('انتهت صلاحية الجلسة — أعد فتح صفحة الفواتير من داخل البرنامج.');
        }
        throw new Error('تعذر تحميل بيانات الفواتير.');
      }
      return res.json();
    })
    .then(renderBilling)
    .catch((err) => showError(err.message || 'حدث خطأ غير متوقع.'));

  function renderBilling(data) {
    loadingEl.hidden = true;
    contentEl.hidden = false;

    document.getElementById('emailLabel').textContent = data.email;
    document.getElementById('planPill').textContent = PLAN_LABELS[data.plan] || data.plan;

    const subEl = document.getElementById('subscriptionInfo');
    if (data.subscription) {
      const expires = new Date(data.subscription.expiresAt);
      subEl.textContent = `الاشتراك ساري حتى ${expires.toLocaleDateString('ar-EG')}`;
    } else {
      subEl.textContent = data.plan === 'free' ? 'مفيش اشتراك نشط حاليًا' : '';
    }

    const usage = data.usage;
    const percent = usage.percentUsed;
    const fillEl = document.getElementById('usageBarFill');
    fillEl.style.width = percent + '%';
    fillEl.className = 'usage-bar-fill' + (percent >= 90 ? ' danger' : percent >= 70 ? ' warn' : '');

    document.getElementById('usageNumbers').textContent =
      usage.limitTokens > 0
        ? `${usage.totalTokens.toLocaleString()} / ${usage.limitTokens.toLocaleString()} توكن`
        : `${usage.totalTokens.toLocaleString()} توكن مستخدمة (الباقة المجانية لا تشمل توكنز AI)`;
    document.getElementById('usagePercent').textContent = usage.limitTokens > 0 ? percent + '%' : '';

    const breakdownEl = document.getElementById('modelBreakdown');
    if (usage.byModel.length > 0) {
      breakdownEl.innerHTML = usage.byModel.map(m =>
        `<div class="model-row"><span>${m.label}</span><span>${m.totalTokens.toLocaleString()} توكن — ${m.requestCount} طلب</span></div>`
      ).join('');
    }

    const uid = new URLSearchParams(location.search).get('uid') || '';
    document.getElementById('upgradeBtn').href = `/?sku=pro_monthly${uid ? '&uid=' + encodeURIComponent(uid) : ''}`;
    document.getElementById('renewBtn').href = `/?sku=${data.plan === 'team' ? 'team_monthly' : 'pro_monthly'}${uid ? '&uid=' + encodeURIComponent(uid) : ''}`;
  }
})();
