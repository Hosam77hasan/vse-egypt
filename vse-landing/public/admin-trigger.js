// admin-trigger.js — hidden entry point into the admin PWA (admin.html).
//
// Long-press (3 sec) on the Sphinx icon in the footer, then a passcode modal.
// The actual security boundary is server-side: /v1/payment/admin/login verifies
// the passcode against a bcrypt hash and enforces lockout (middleware/adminAuth.js).
// This file never contains the passcode itself.
(function () {
  const BACKEND_URL = (window.VSE_CONFIG && window.VSE_CONFIG.backendUrl) || 'http://localhost:8787';
  const LONG_PRESS_MS = 3000;
  const SESSION_KEY = 'vseAdminToken';

  const trigger = document.getElementById('stealthTrigger');
  if (!trigger) return;

  // Make the Sphinx icon look interactive
  trigger.style.cursor = 'pointer';
  trigger.style.userSelect = 'none';
  trigger.style.transition = 'transform 0.2s, opacity 0.2s';

  let pressTimer = null;

  function startPress() {
    clearTimeout(pressTimer);
    trigger.style.transform = 'scale(1.2)';
    trigger.style.opacity = '0.7';
    pressTimer = setTimeout(openPasscodeModal, LONG_PRESS_MS);
  }
  function cancelPress() {
    clearTimeout(pressTimer);
    trigger.style.transform = 'scale(1)';
    trigger.style.opacity = '1';
  }

  trigger.addEventListener('mousedown', startPress);
  trigger.addEventListener('touchstart', startPress, { passive: true });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(evt => {
    trigger.addEventListener(evt, cancelPress);
  });

  function openPasscodeModal() {
    if (document.getElementById('vseAdminModal')) return;
    trigger.style.transform = 'scale(1)';
    trigger.style.opacity = '1';

    const overlay = document.createElement('div');
    overlay.id = 'vseAdminModal';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.88); z-index:9999; display:flex; align-items:center; justify-content:center; font-family:"Cairo",sans-serif; backdrop-filter:blur(4px);';

    overlay.innerHTML = `
      <div style="background:#fff; border:2px solid var(--lime,#aacc00); border-radius:14px; padding:32px 24px; width:min(300px,90vw); text-align:center; box-shadow:0 12px 40px rgba(0,0,0,0.3);">
        <div style="font-size:40px; margin-bottom:6px;">🏛️</div>
        <p style="color:#000; margin-bottom:16px; font-size:15px; font-weight:700;">لوحة تحكم الأدمن</p>
        <input id="vseAdminPasscode" type="password" inputmode="numeric" autocomplete="off" placeholder="كود الدخول"
          style="width:100%; padding:12px; border-radius:8px; border:2px solid #ccc; background:#fff; color:#000; text-align:center; font-size:18px; letter-spacing:5px; font-family:'Cairo',sans-serif;" />
        <p id="vseAdminError" style="color:#ff4444; font-size:12px; min-height:18px; margin-top:8px; font-weight:600;"></p>
        <div style="display:flex; gap:8px; margin-top:12px;">
          <button id="vseAdminCancel" style="flex:1; padding:11px; border-radius:8px; border:2px solid #ddd; background:#f5f5f5; color:#000; font-weight:700; cursor:pointer; font-family:'Cairo',sans-serif;">إلغاء</button>
          <button id="vseAdminSubmit" style="flex:1; padding:11px; border-radius:8px; border:none; background:#aacc00; color:#000; font-weight:800; cursor:pointer; font-family:'Cairo',sans-serif;">دخول</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('vseAdminPasscode');
    const errorEl = document.getElementById('vseAdminError');
    input.focus();

    function close() { overlay.remove(); }

    document.getElementById('vseAdminCancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    async function submit() {
      const passcode = input.value;
      if (!passcode) { errorEl.textContent = 'اكتب كود الدخول'; return; }

      const submitBtn = document.getElementById('vseAdminSubmit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'جاري...';
      errorEl.textContent = '';

      try {
        const res = await fetch(`${BACKEND_URL}/v1/payment/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode }),
        });
        const data = await res.json();

        if (res.ok && data.token) {
          sessionStorage.setItem(SESSION_KEY, data.token);
          location.href = 'admin.html';
          return;
        }

        errorEl.textContent = res.status === 429
          ? (data.message || 'محاولات كتير — استنى شوية.')
          : 'كود غلط — حاول تاني.';
      } catch (err) {
        errorEl.textContent = 'مشكلة في الاتصال بالسيرفر.';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'دخول';
      }
    }

    document.getElementById('vseAdminSubmit').addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }
})();
