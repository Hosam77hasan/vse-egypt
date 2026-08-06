// admin-trigger.js — hidden entry point into the admin PWA (admin.html).
//
// This is UX obscurity only, not the real security boundary: a long-press on the
// footer copyright period, then a passcode modal. Anyone reading this file's
// source (trivial on GitHub Pages) can see the trigger exists — that's fine and
// expected. The actual boundary is server-side: /v1/payment/admin/login verifies
// the passcode against a bcrypt hash (never compared/stored in plaintext) and
// enforces a persistent lockout after repeated failures (see vse-backend's
// middleware/adminAuth.js). This file never contains the passcode itself.
(function () {
  const BACKEND_URL = (window.VSE_CONFIG && window.VSE_CONFIG.backendUrl) || 'http://localhost:8787';
  const LONG_PRESS_MS = 3000;
  const SESSION_KEY = 'vseAdminToken';

  const trigger = document.getElementById('stealthTrigger');
  if (!trigger) return;

  let pressTimer = null;

  function startPress() {
    clearTimeout(pressTimer);
    pressTimer = setTimeout(openPasscodeModal, LONG_PRESS_MS);
  }
  function cancelPress() {
    clearTimeout(pressTimer);
  }

  trigger.addEventListener('mousedown', startPress);
  trigger.addEventListener('touchstart', startPress, { passive: true });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(evt => {
    trigger.addEventListener(evt, cancelPress);
  });

  function openPasscodeModal() {
    if (document.getElementById('vseAdminModal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'vseAdminModal';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:9999; display:flex; align-items:center; justify-content:center; font-family:var(--font-body, sans-serif);';

    overlay.innerHTML = `
      <div style="background:#151515; border:1px solid #2A2A2A; border-radius:10px; padding:28px; width:280px; text-align:center;">
        <p style="color:#EDEDED; margin-bottom:14px; font-size:14px;">كود الدخول</p>
        <input id="vseAdminPasscode" type="password" inputmode="numeric" autocomplete="off"
          style="width:100%; padding:10px; border-radius:6px; border:1px solid #2A2A2A; background:#0A0A0A; color:#C6FF00; text-align:center; font-size:18px; letter-spacing:4px;" />
        <p id="vseAdminError" style="color:#ff6b6b; font-size:12px; min-height:16px; margin-top:8px;"></p>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button id="vseAdminCancel" style="flex:1; padding:9px; border-radius:6px; border:1px solid #2A2A2A; background:transparent; color:#8A8F7A; cursor:pointer;">إلغاء</button>
          <button id="vseAdminSubmit" style="flex:1; padding:9px; border-radius:6px; border:none; background:#C6FF00; color:#000; font-weight:700; cursor:pointer;">دخول</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('vseAdminPasscode');
    const errorEl = document.getElementById('vseAdminError');
    input.focus();

    function close() {
      overlay.remove();
    }

    document.getElementById('vseAdminCancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    async function submit() {
      const passcode = input.value;
      if (!passcode) return;

      const submitBtn = document.getElementById('vseAdminSubmit');
      submitBtn.disabled = true;
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
          ? (data.message || 'محاولات كتير — حاول لاحقًا.')
          : 'كود غلط.';
      } catch (err) {
        errorEl.textContent = 'مشكلة في الاتصال.';
      } finally {
        submitBtn.disabled = false;
      }
    }

    document.getElementById('vseAdminSubmit').addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }
})();
