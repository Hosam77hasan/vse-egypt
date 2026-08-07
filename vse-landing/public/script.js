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

  // ---------- Pricing: Direct redirect with locked amount ----------
  const PORTAL = window.VSE_CONFIG.paymentPortalUrl;

  // Pro & Team plan buttons — redirect with locked amount
  document.querySelectorAll('.price-cta').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const amount = btn.dataset.amount;
      const plan = btn.dataset.plan || '';
      window.location.href = `${PORTAL}/?amount=${amount}&plan=${plan}`;
    });
  });

  // Pay-as-you-go top-up chips — redirect with selected amount
  document.querySelectorAll('.topup-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const amount = chip.dataset.amount;
      window.location.href = `${PORTAL}/?amount=${amount}&plan=topup`;
    });
  });

  // The support page lives on the payment portal
  document.getElementById('supportLink').href = `${PORTAL}/support.html`;
})();
