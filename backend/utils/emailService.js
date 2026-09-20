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
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>Bideo Verification Code</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Card (Max 440px for mobile perfection) -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 440px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #fed7aa; box-shadow: 0 4px 18px rgba(0, 0, 0, 0.06);">
          <!-- Orange Header with White Logo Pill -->
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #FF7A00 0%, #EA580C 100%); background-color: #FF7A00; padding: 24px 20px 20px; text-align: center;">
              <!-- White Logo Container (Guarantees perfect visibility in both light & dark mode) -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="background-color: #ffffff; background: #ffffff !important; border-radius: 12px; padding: 10px 22px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); border: 1px solid #fed7aa;">
                    <a href="https://bideo.in" target="_blank" style="text-decoration: none; display: block;">
                      <img 
                        src="https://bideo.in/assets/logo-csgcheGF.png" 
                        alt="Bideo" 
                        width="135" 
                        style="display: block; margin: 0 auto; width: 135px; max-width: 135px; height: auto; border: 0; outline: none; text-decoration: none;" 
                      />
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.4px;">
                Creator Security Verification
              </p>
            </td>
          </tr>

          <!-- Content Section -->
          <tr>
            <td style="padding: 26px 22px 20px; background-color: #ffffff; text-align: center;">
              <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #0f172a; text-align: center;">
                Hello ${name ? name : 'Creator'},
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #475569; text-align: center;">
                Use the 6-digit verification code below to <strong>${purposeTitle || 'verify your email address'}</strong>.
              </p>

              <!-- Compact Centered OTP Box (Fixed width to avoid stretching on phone) -->
              <div style="text-align: center; margin: 18px auto 22px; width: 100%;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                  <tr>
                    <td align="center" style="background-color: #fff7ed; border: 2px solid #f97316; border-radius: 12px; padding: 12px 24px; text-align: center; box-shadow: 0 2px 6px rgba(249, 115, 22, 0.1);">
                      <span style="font-size: 32px; font-weight: 800; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, monospace; color: #ea580c; letter-spacing: 6px; text-indent: 6px; display: inline-block;">
                        ${otp}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-top: 8px;">
                      <span style="display: inline-block; font-size: 11px; font-weight: 600; color: #c2410c; background-color: #ffedd5; border: 1px solid #fed7aa; padding: 3px 12px; border-radius: 20px;">
                        ⏱ Valid for 10 minutes
                      </span>
                    </td>
                  </tr>
                </table>
              </div>

              <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #64748b; text-align: center;">
                Enter this code in the Bideo app to complete your verification and unlock creator upload privileges.
              </p>

              <!-- Security Notice -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 16px;">
                <tr>
                  <td style="background-color: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 0 6px 6px 0; padding: 10px 12px; text-align: left;">
                    <p style="margin: 0; font-size: 11px; line-height: 1.4; color: #92400e;">
                      <strong>Security Tip:</strong> Never share this code with anyone. Bideo representatives will never ask for your verification code.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 14px 20px; text-align: center; border-top: 1px solid #fed7aa; font-size: 11px; color: #94a3b8; line-height: 1.4;">
              &copy; ${currentYear} Bideo. All rights reserved.<br />
              This is an automated security transmission. Please do not reply.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
