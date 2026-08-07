(function () {
  // ---------- Hero editor typing animation ----------
  const codeLines = [
    { text: 'function ', kw: true },
    { text: 'calculateTotal', kw: false },
    { text: '(items) {\n  return items.', kw: false },
    { text: 'reduce', kw: true },
    { text: '((sum, i) => sum + i.price, ', kw: false },
    { text: '0', kw: false },
    { text: ');\n}', kw: false },
  ];
  const editorCodeEl = document.getElementById('editorCode');
  const ctrlkPopup = document.getElementById('ctrlkPopup');
  const ctrlkPromptEl = document.getElementById('ctrlkPrompt');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function typeSequence() {
    if (prefersReducedMotion) {
      // Render the final state immediately, skip the animated sequence entirely.
      editorCodeEl.textContent = codeLines.map(l => l.text).join('');
      ctrlkPopup.classList.add('visible');
      ctrlkPromptEl.textContent = 'convert to arrow function with types';
      return;
    }

    let full = '';
    let lineIndex = 0;
    let charIndex = 0;

    function typeChar() {
      if (lineIndex >= codeLines.length) {
        setTimeout(showCtrlK, 600);
        return;
      }
      const line = codeLines[lineIndex];
      if (charIndex < line.text.length) {
        full += line.text[charIndex];
        editorCodeEl.innerHTML = escapeHtml(full) + '<span class="cur"></span>';
        charIndex++;
        setTimeout(typeChar, 28);
      } else {
        lineIndex++;
        charIndex = 0;
        setTimeout(typeChar, 40);
      }
    }

    function showCtrlK() {
      ctrlkPopup.classList.add('visible');
      const prompt = 'convert to arrow function with types';
      let i = 0;
      function typePrompt() {
        if (i <= prompt.length) {
          ctrlkPromptEl.textContent = prompt.slice(0, i);
          i++;
          setTimeout(typePrompt, 35);
        } else {
          setTimeout(resetLoop, 2400);
        }
      }
      typePrompt();
    }

    function resetLoop() {
      ctrlkPopup.classList.remove('visible');
      ctrlkPromptEl.textContent = '';
      full = '';
      lineIndex = 0;
      charIndex = 0;
      editorCodeEl.textContent = '';
      setTimeout(typeChar, 500);
    }

    typeChar();
  }

  function escapeHtml(str) {
    return str.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  typeSequence();

  // ---------- Smart OS-detecting download button ----------
  // Client-side OS sniffing is inherently a best-effort hint, not a guarantee — the
  // full options list in #download is always available as the reliable fallback.
  function detectOs() {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    if (/Mac/i.test(platform) || /Mac OS X/i.test(ua)) {
      return { label: 'macOS', href: window.VSE_CONFIG.downloads.macArm64 };
    }
    if (/Win/i.test(platform) || /Windows/i.test(ua)) {
      return { label: 'Windows', href: window.VSE_CONFIG.downloads.windowsExe };
    }
    return { label: 'نظامك', href: '#download' };
  }

  // Wire download buttons if they exist (they may be replaced by "coming soon"
  // placeholders until compiled binaries are released). Skip silently when absent
  // so the same script.js works both before and after the download section redesign.
  ['dlWindowsExe','dlWindowsMsi','dlMacArm64','dlMacX64'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = window.VSE_CONFIG.downloads[id === 'dlWindowsExe' ? 'windowsExe' : id === 'dlWindowsMsi' ? 'windowsMsi' : id === 'dlMacArm64' ? 'macArm64' : 'macX64'];
  });

  const detected = detectOs();
  document.getElementById('detectedOs').textContent = detected.label;
  document.getElementById('smartDownloadBtn').addEventListener('click', () => {
    if (detected.href.startsWith('#')) {
      document.querySelector(detected.href).scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.href = detected.href;
    }
  });

  // ---------- Pricing: period + currency toggle ----------
  let period = 'monthly'; // 'monthly' | 'yearly'
  let currency = 'egp';   // 'egp' | 'usd'

  function updatePricing() {
    document.querySelectorAll('.amount').forEach((el) => {
      const value = el.dataset[currency + (period === 'monthly' ? 'Monthly' : 'Yearly')];
      el.textContent = value;
    });
    document.querySelectorAll('.currency-label').forEach((el) => {
      el.textContent = currency.toUpperCase();
    });
    document.querySelectorAll('.period-label').forEach((el) => {
      el.textContent = period === 'monthly' ? 'شهر' : 'سنة';
    });
    document.querySelectorAll('.price-cta').forEach((el) => {
      const sku = period === 'monthly' ? el.dataset.skuMonthly : el.dataset.skuYearly;
      el.href = `${window.VSE_CONFIG.paymentPortalUrl}/?sku=${encodeURIComponent(sku)}`;
    });
  }

  document.getElementById('periodToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-btn');
    if (!btn) return;
    period = btn.dataset.period;
    document.querySelectorAll('#periodToggle .toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
    updatePricing();
  });

  document.getElementById('currencyToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-btn');
    if (!btn) return;
    currency = btn.dataset.currency;
    document.querySelectorAll('#currencyToggle .toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
    updatePricing();
  });

  // The support page lives on the payment portal (vse-payment-portal/public/support.html) —
  // built as a direct link, not a click handler, so it works with "open in new tab" /
  // middle-click too, and needs no JS to be a valid link if config.js somehow fails to load.
  document.getElementById('supportLink').href = `${window.VSE_CONFIG.paymentPortalUrl}/support.html`;

  updatePricing();
})();
