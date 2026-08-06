(function () {
  const plansSection = document.getElementById('plans');
  const methodSection = document.getElementById('paymentMethod');
  const resultSection = document.getElementById('result');

  let selectedSku = null;

  // A real deployment gets this from an authenticated session (cookie/JWT from
  // the portal's own login), never from a query param a user could tamper with.
  // Left explicit here so the gap is obvious rather than silently assumed.
  const CURRENT_USER_ID = new URLSearchParams(location.search).get('uid') || null;

  // Handoff from vse-landing's pricing CTAs (?sku=pro_monthly etc.) — skip straight
  // to the payment method step instead of making the user re-pick the plan they
  // already selected on the landing page. Kept in sync with server/index.js's
  // PLAN_CATALOG; the server re-validates regardless, this is just a UX shortcut.
  const KNOWN_SKUS = ['pro_monthly', 'pro_yearly', 'team_monthly', 'team_yearly', 'topup_100', 'topup_200', 'topup_400', 'topup_800', 'topup_1000'];
  const incomingSku = new URLSearchParams(location.search).get('sku');
  if (incomingSku && KNOWN_SKUS.includes(incomingSku)) {
    selectedSku = incomingSku;
    plansSection.hidden = true;
    methodSection.hidden = false;
  }

  document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedSku = card.dataset.sku;
      plansSection.hidden = true;
      methodSection.hidden = false;
    });
  });

  document.getElementById('backToPlans').addEventListener('click', () => {
    methodSection.hidden = true;
    plansSection.hidden = false;
  });

  document.querySelectorAll('.method-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.method-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isVodafone = tab.dataset.method === 'vodafone-cash';
      document.getElementById('vodafoneForm').hidden = !isVodafone;
      document.getElementById('meezaForm').hidden = isVodafone;
    });
  });

  document.getElementById('vodafoneForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    await submitCheckout('/checkout/vodafone-cash', { userId: requireUserId(), sku: selectedSku, phoneNumber });
  });

  document.getElementById('meezaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    // Last-4 only — see server-side comment on why full PAN never belongs here.
    const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
    await submitCheckout('/checkout/meeza', {
      userId: requireUserId(),
      sku: selectedSku,
      cardLast4: cardNumber.slice(-4),
    });
  });

  document.getElementById('retryBtn').addEventListener('click', () => {
    resultSection.hidden = true;
    document.getElementById('resultError').hidden = true;
    methodSection.hidden = false;
  });

  function requireUserId() {
    if (!CURRENT_USER_ID) {
      alert('لازم تكون مسجل دخول الأول. افتح صفحة الشحن دي من جوه برنامج VS Code Egypt نفسه.');
      throw new Error('missing user id');
    }
    return CURRENT_USER_ID;
  }

  async function submitCheckout(endpoint, body) {
    const submitBtn = document.activeElement;
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      methodSection.hidden = true;
      resultSection.hidden = false;

      if (res.ok && data.success) {
        document.getElementById('resultSuccess').hidden = false;
        if (data.topup) {
          // Credit top-ups don't issue a new license token — the user is already
          // signed in and this just raised their wallet balance, so there's
          // nothing to "activate" via the vscode-egypt:// deep link.
          document.getElementById('licenseTokenDisplay').textContent =
            'تم شحن ' + data.topup.tokensGranted.toLocaleString() + ' توكن. الرصيد الحالي: ' + data.topup.newBalance.toLocaleString();
          document.getElementById('activateLink').textContent = 'ارجع لـ VS Code Egypt';
          document.getElementById('activateLink').href = 'vscode-egypt://';
        } else {
          document.getElementById('licenseTokenDisplay').textContent = data.license.token;
          // Hands the token to the desktop app via its registered custom protocol
          // (urlProtocol: "vscode-egypt" in product.json) so the user doesn't have
          // to copy/paste in the common case.
          document.getElementById('activateLink').href =
            `vscode-egypt://activate?token=${encodeURIComponent(data.license.token)}`;
        }
      } else {
        document.getElementById('resultError').hidden = false;
        document.getElementById('resultErrorMessage').textContent =
          data.message || 'الدفع ما اتأكدش. مفيش أي مبلغ اتخصم منك.';
      }
    } catch (err) {
      methodSection.hidden = true;
      resultSection.hidden = false;
      document.getElementById('resultError').hidden = false;
      document.getElementById('resultErrorMessage').textContent = 'في مشكلة في الاتصال — حاول تاني.';
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }
})();
