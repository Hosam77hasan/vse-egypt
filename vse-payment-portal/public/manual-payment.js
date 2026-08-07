(function () {
  const VSE_BACKEND_URL = window.__VSE_BACKEND_URL__ || 'http://localhost:8787';

  // Injected server-side by server/index.js's /manual-payment route (same pattern
  // as __VSE_BACKEND_URL__ on /dashboard/billing) so the real handles/addresses
  // live in that server's env vars, never hardcoded into this static bundle.
  const CHANNELS = window.__VSE_PAYMENT_CHANNELS__ || {};

  const CHANNEL_LABELS = {
    instapay: { title: '🇪🇬 InstaPay', refLabel: 'رقم مرجع عملية InstaPay' },
    vodafone_cash: { title: '🇪🇬 فودافون كاش / محفظة بنك مصر', refLabel: 'رقم الموبايل اللي حولت منه' },
    paypal: { title: '🌍 PayPal', refLabel: 'Transaction ID بتاع PayPal' },
    crypto: { title: '🌍 USDT (TRC20)', refLabel: 'رقم الـ Transaction Hash' },
  };

  let selectedMethod = 'instapay';

  const channelDetailsEl = document.getElementById('channelDetails');
  const transactionRefLabelEl = document.getElementById('transactionRefLabel');
  const currencyEl = document.getElementById('currency');
  const formViewEl = document.getElementById('formView');
  const resultBoxEl = document.getElementById('resultBox');
  const payFormEl = document.getElementById('payForm');

  function renderChannel(method) {
    const meta = CHANNEL_LABELS[method];
    const detail = CHANNELS[method];

    transactionRefLabelEl.textContent = meta.refLabel;
    currencyEl.value = (method === 'paypal' || method === 'crypto') ? 'USD' : 'EGP';

    if (!detail) {
      channelDetailsEl.innerHTML = `<h3>${meta.title}</h3><p style="color:#888; font-size:13px;">وسيلة الدفع دي مش متاحة دلوقتي.</p>`;
      return;
    }

    const rows = Object.entries(detail).map(([label, value]) => {
      const isPaypal = method === 'paypal';
      const isCopy = !isPaypal;
      // Extract PayPal username for the direct link
      const paypalUser = isPaypal ? value.replace(/.*paypal\.me\/?/, '').replace(/^@/, '') : '';
      const paypalUrl = isPaypal ? `https://paypal.me/${paypalUser}` : '';

      return `
      <div class="channel-detail">
        <div class="detail-info">
          <div class="detail-label">${escapeHtml(label)}</div>
          <div class="detail-value">${escapeHtml(value)}</div>
        </div>
        ${isPaypal
          ? `<a href="${escapeHtml(paypalUrl)}" target="_blank" rel="noopener" class="open-btn">💸 افتح PayPal</a>`
          : `<button type="button" class="copy-btn" data-copy="${escapeHtml(value)}">📋 نسخ</button>`
        }
      </div>
    `}).join('');

    channelDetailsEl.innerHTML = `<h3>${meta.title}</h3>${rows}`;

    channelDetailsEl.querySelectorAll('.copy-btn[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard?.writeText(btn.dataset.copy);
        btn.textContent = '✓ اتنسخ';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = '📋 نسخ';
          btn.classList.remove('copied');
        }, 2000);
      });
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  document.querySelectorAll('.channel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.channel-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedMethod = tab.dataset.method;
      renderChannel(selectedMethod);
    });
  });

  renderChannel(selectedMethod);

  payFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري الإرسال...';

    const body = {
      email: document.getElementById('email').value.trim(),
      amount: Number(document.getElementById('amount').value),
      currency: currencyEl.value,
      paymentMethod: selectedMethod,
      transactionRef: document.getElementById('transactionRef').value.trim(),
      notes: document.getElementById('notes').value.trim() || undefined,
    };

    try {
      const res = await fetch(`${VSE_BACKEND_URL}/v1/payment/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      formViewEl.hidden = true;
      resultBoxEl.classList.add('show');

      if (res.ok && data.submitted) {
        resultBoxEl.classList.remove('error');
        resultBoxEl.innerHTML = `
          <h2>✅ استلمنا طلبك</h2>
          <p>طلب رقم #${data.request.id} — هيتشحن ${data.request.tokensRequested.toLocaleString()} توكن بمجرد الموافقة.</p>
          <p style="color:#888; font-size:13px;">هنراجعه ونرد عليك على الإيميل اللي كتبته.</p>
        `;
      } else {
        resultBoxEl.classList.add('error');
        resultBoxEl.innerHTML = `<h2>حصل خطأ</h2><p>${escapeHtml(data.message || 'تعذر إرسال الطلب — تأكد من البيانات وحاول تاني.')}</p>`;
      }
    } catch (err) {
      formViewEl.hidden = true;
      resultBoxEl.classList.add('show', 'error');
      resultBoxEl.innerHTML = `<h2>حصل خطأ</h2><p>في مشكلة في الاتصال — حاول تاني.</p>`;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'إرسال الطلب';
    }
  });
})();
