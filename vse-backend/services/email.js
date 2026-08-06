/*
 * SMTP wrapper for OTP / verification emails.
 *
 * ============================== SIMULATION NOTICE ==============================
 * With no SMTP_* env vars set, this falls back to a "dev transport" that just logs
 * the email to the console instead of sending it — so you can develop/test the
 * signup flow without a real mail provider. Set SMTP_HOST/PORT/USER/PASS (or swap
 * in a provider SDK like SendGrid/Postmark/SES) before going to production; no
 * code path here fabricates an actual mail delivery guarantee.
 * ==================================================================================
 */
const nodemailer = require('nodemailer');

let transporter = null;
let devMode = false;

function getTransporter() {
    if (transporter) return transporter;

    if (!process.env.SMTP_HOST) {
        devMode = true;
        console.warn('[vse-backend/email] No SMTP_HOST configured — running in DEV MODE. Emails will be logged, not sent.');
        transporter = {
            sendMail: async (opts) => {
                console.log('\n========== [DEV EMAIL] ==========');
                console.log('To:', opts.to);
                console.log('Subject:', opts.subject);
                console.log('Body:\n', opts.text || opts.html);
                console.log('==================================\n');
                return { messageId: 'dev-mode-no-real-send' };
            },
        };
        return transporter;
    }

    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    // Verify the connection at startup rather than waiting for the first real
    // signup to discover a bad host/port/credential — logs loudly but does not
    // crash the server, since a transient network blip here shouldn't take down
    // the whole API.
    transporter.verify()
        .then(() => console.log('[vse-backend/email] SMTP connection verified OK.'))
        .catch((err) => console.error('[vse-backend/email] SMTP verification FAILED — emails will not send until this is fixed:', err.message));

    return transporter;
}

async function sendOtpEmail(toEmail, code, purpose) {
    const subject = purpose === 'password_reset'
        ? 'VS Code Egypt — Password reset code'
        : 'VS Code Egypt — Verify your email';

    const text = purpose === 'password_reset'
        ? `Your password reset code is: ${code}\n\nThis code expires in 15 minutes. If you didn't request this, ignore this email.`
        : `Welcome to VS Code Egypt!\n\nYour verification code is: ${code}\n\nThis code expires in 15 minutes.`;

    const html = `
        <div style="font-family:sans-serif; background:#0A0A0A; color:#EDEDED; padding:32px; border-radius:8px; max-width:420px;">
            <div style="font-weight:700; font-size:18px; margin-bottom:20px;">VS Code <span style="color:#C6FF00;">Egypt</span></div>
            <p style="font-size:14px; color:#ccc;">${purpose === 'password_reset' ? 'Your password reset code:' : 'Your verification code:'}</p>
            <div style="font-family:monospace; font-size:32px; letter-spacing:8px; color:#C6FF00; background:#151515; padding:16px; border-radius:6px; text-align:center; margin:16px 0;">${code}</div>
            <p style="font-size:12px; color:#888;">This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
    `;

    // sendMail can genuinely throw here with a real SMTP transport (auth failure,
    // connection refused, provider rate limit) — unlike the dev-mode stub, which
    // never throws. Callers (routes/auth.js) wrap this in try/catch and return a
    // clean error to the client instead of letting it become an unhandled
    // rejection, which Express 4 does not auto-catch on async route handlers.
    const t = getTransporter();
    await t.sendMail({
        from: process.env.SMTP_FROM || 'VS Code Egypt <no-reply@vscode-egypt.example>',
        to: toEmail,
        subject,
        text,
        html,
    });

    return { devMode };
}

module.exports = { sendOtpEmail };
