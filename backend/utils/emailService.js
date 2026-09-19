const nodemailer = require('nodemailer');

/**
 * Multi-Provider Email Service with Automatic Failover
 * 
 * Providers Chain:
 * 1. Gmail SMTP (Primary - 500 emails/day FREE)
 * 2. Brevo / Sendinblue SMTP (Fallback 1 - 300 emails/day FREE)
 * 3. Resend SMTP (Fallback 2 - 3,000 emails/month FREE)
 */

// Generate professional responsive HTML template for Bideo OTP emails
const generateOtpHtmlTemplate = ({ otp, name, purposeTitle }) => {
  const currentYear = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bideo Verification Code</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6fb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .email-container {
      max-width: 540px;
      margin: 36px auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .brand-title {
      color: #ffffff;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .brand-subtitle {
      color: #e0e7ff;
      font-size: 13px;
      font-weight: 500;
      margin-top: 6px;
      margin-bottom: 0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .content {
      padding: 36px 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .message {
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    .otp-box-wrapper {
      text-align: center;
      margin: 28px 0;
    }
    .otp-box {
      display: inline-block;
      background: #f8fafc;
      border: 2px dashed #6366f1;
      border-radius: 12px;
      padding: 18px 36px;
      letter-spacing: 8px;
      font-size: 36px;
      font-weight: 800;
      font-family: 'Courier New', Courier, monospace;
      color: #4f46e5;
    }
    .expiry-badge {
      display: inline-block;
      margin-top: 10px;
      font-size: 12px;
      font-weight: 600;
      color: #ea580c;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      padding: 4px 12px;
      border-radius: 9999px;
    }
    .security-notice {
      background-color: #f1f5f9;
      border-left: 4px solid #64748b;
      padding: 14px 16px;
      border-radius: 0 8px 8px 0;
      font-size: 13px;
      color: #475569;
      margin-top: 24px;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1 class="brand-title">Bideo</h1>
      <p class="brand-subtitle">Creator Security Verification</p>
    </div>
    <div class="content">
      <h2 class="greeting">Hello ${name ? name : 'Creator'},</h2>
      <p class="message">
        You recently requested a verification code for your Bideo account to <strong>${purposeTitle || 'verify your email address'}</strong>.
      </p>

      <div class="otp-box-wrapper">
        <div class="otp-box">${otp}</div>
        <div>
          <span class="expiry-badge">⏱ Expires in 10 minutes</span>
        </div>
      </div>

      <p class="message" style="margin-bottom: 0;">
        Enter this 6-digit code in the Bideo mobile app to complete your verification and unlock creator upload privileges.
      </p>

      <div class="security-notice">
        <strong>Security Notice:</strong> Never share this code with anyone. Bideo representatives will never ask for your verification code. If you did not make this request, you can safely ignore this email.
      </div>
    </div>
    <div class="footer">
      &copy; ${currentYear} Bideo. All rights reserved.<br />
      This is an automated security transmission. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
`;
};

// 1. Send via Gmail SMTP
const sendViaGmail = async ({ to, subject, html, text }) => {
  const user = process.env.GMAIL_USER || process.env.EMAIL_USER;
  const pass = (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (!user || !pass) {
    throw new Error('Gmail credentials not configured (GMAIL_USER / GMAIL_APP_PASSWORD missing)');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const fromName = process.env.EMAIL_FROM_NAME || 'Bideo';
  return transporter.sendMail({
    from: `"${fromName}" <${user}>`,
    to,
    subject,
    text,
    html,
  });
};

// 2. Send via Brevo (Sendinblue) SMTP
const sendViaBrevo = async ({ to, subject, html, text }) => {
  const user = process.env.BREVO_SMTP_USER || process.env.GMAIL_USER || process.env.EMAIL_USER;
  const pass = process.env.BREVO_SMTP_KEY;

  if (!pass) {
    throw new Error('Brevo credentials not configured (BREVO_SMTP_KEY missing)');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: user,
      pass: pass,
    },
  });

  const fromName = process.env.EMAIL_FROM_NAME || 'Bideo';
  const fromEmail = process.env.BREVO_FROM_EMAIL || process.env.GMAIL_USER || user;
  return transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text,
    html,
  });
};

// 3. Send via Resend SMTP
const sendViaResend = async ({ to, subject, html, text }) => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('Resend credentials not configured (RESEND_API_KEY missing)');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
      user: 'resend',
      pass: apiKey,
    },
  });

  const fromName = process.env.EMAIL_FROM_NAME || 'Bideo';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  return transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text,
    html,
  });
};

/**
 * Dispatch an email with automatic fallback through the provider chain
 */
const sendMailWithFailover = async ({ to, subject, html, text }) => {
  const providers = [
    { name: 'Gmail', send: sendViaGmail },
    { name: 'Brevo', send: sendViaBrevo },
    { name: 'Resend', send: sendViaResend },
  ];

  const errors = [];
  let attemptedCount = 0;

  for (const provider of providers) {
    try {
      // Test if provider has credentials before attempting
      if (provider.name === 'Gmail') {
        const user = process.env.GMAIL_USER || process.env.EMAIL_USER;
        const pass = process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_APP_PASSWORD;
        if (!user || !pass) continue;
      } else if (provider.name === 'Brevo') {
        if (!process.env.BREVO_SMTP_KEY) continue;
      } else if (provider.name === 'Resend') {
        if (!process.env.RESEND_API_KEY) continue;
      }

      attemptedCount++;
      const info = await provider.send({ to, subject, html, text });
      console.log(`[EmailService] Email successfully delivered to ${to} via ${provider.name} (ID: ${info?.messageId || 'ok'})`);
      return {
        success: true,
        provider: provider.name,
        messageId: info?.messageId,
      };
    } catch (err) {
      console.warn(`[EmailService] Provider ${provider.name} failed to send to ${to}: ${err.message}. Trying next provider...`);
      errors.push({ provider: provider.name, error: err.message });
    }
  }

  if (attemptedCount === 0) {
    throw new Error('No email provider is configured. Please add GMAIL_USER & GMAIL_APP_PASSWORD in backend/.env');
  }

  const errorSummary = errors.map((e) => `${e.provider}: ${e.error}`).join('; ');
  throw new Error(`All email providers failed to send email. (${errorSummary})`);
};

/**
 * Send OTP Verification Email
 */
exports.sendOtpEmail = async ({ to, otp, name, purposeTitle = 'verify your email address' }) => {
  const subject = `${otp} is your Bideo verification code`;
  const html = generateOtpHtmlTemplate({ otp, name, purposeTitle });
  const text = `Your Bideo verification code is: ${otp}\n\nThis code is valid for 10 minutes. Do not share this code with anyone.\n\n© Bideo`;

  return sendMailWithFailover({ to, subject, html, text });
};

exports.sendMailWithFailover = sendMailWithFailover;
