import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export async function sendMagicLinkEmail(
  toEmail: string,
  displayName: string,
  token: string
): Promise<void> {
  const magicLink = `${FRONTEND_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;

  await resend.emails.send({
    from: "The Away End Bracket <noreply@awayendbracket.com>",
    to: toEmail,
    subject: "Sign in to The Away End Bracket",
    html: buildMagicLinkHtml(displayName, magicLink),
    text: buildMagicLinkText(displayName, magicLink),
  });
}

export async function sendRegistrationEmail(
  toEmail: string,
  displayName: string,
  token: string
): Promise<void> {
  const magicLink = `${FRONTEND_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;

  await resend.emails.send({
    from: "The Away End Bracket <noreply@awayendbracket.com>",
    to: toEmail,
    subject: "Welcome to The Away End Bracket Contest",
    html: buildRegistrationHtml(displayName, magicLink),
    text: buildRegistrationText(displayName, magicLink),
  });
}

function buildMagicLinkHtml(displayName: string, magicLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
  <div style="background-color: #ffffff; padding: 40px; border-radius: 8px;">
    <h1 style="color: #1a1a2e; margin-top: 0;">The Away End Bracket</h1>
    <p style="color: #333333; font-size: 16px;">Hi ${displayName},</p>
    <p style="color: #333333; font-size: 16px;">Click the button below to sign in. This link expires in 15 minutes.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${magicLink}"
         style="background-color: #e94560; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 18px; font-weight: bold; display: inline-block;">
        Sign In
      </a>
    </div>
    <p style="color: #666666; font-size: 14px;">Or copy this link into your browser:</p>
    <p style="color: #666666; font-size: 13px; word-break: break-all;">${magicLink}</p>
    <p style="color: #999999; font-size: 12px;">If you didn't request this, you can safely ignore it.</p>
  </div>
</body>
</html>`.trim();
}

function buildMagicLinkText(displayName: string, magicLink: string): string {
  return `
Hi ${displayName},

Click the link below to sign in to The Away End Bracket Contest.

${magicLink}

This link expires in 15 minutes. If you didn't request this, you can safely ignore it.
`.trim();
}

function buildRegistrationHtml(displayName: string, magicLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
  <div style="background-color: #ffffff; padding: 40px; border-radius: 8px;">
    <h1 style="color: #1a1a2e; margin-top: 0;">Welcome to The Away End Bracket!</h1>
    <p style="color: #333333; font-size: 16px;">Hi ${displayName},</p>
    <p style="color: #333333; font-size: 16px;">Your account has been created! Click below to sign in and start making your picks. This link expires in 15 minutes.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${magicLink}"
         style="background-color: #e94560; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 18px; font-weight: bold; display: inline-block;">
        Get Started
      </a>
    </div>
    <p style="color: #666666; font-size: 14px;">Or copy this link into your browser:</p>
    <p style="color: #666666; font-size: 13px; word-break: break-all;">${magicLink}</p>
    <p style="color: #999999; font-size: 12px;">If you didn't create this account, you can safely ignore this email.</p>
  </div>
</body>
</html>`.trim();
}

function buildRegistrationText(displayName: string, magicLink: string): string {
  return `
Welcome to The Away End Bracket Contest!

Hi ${displayName},

Your account has been created! Click the link below to sign in and start making your picks.

${magicLink}

This link expires in 15 minutes. If you didn't create this account, you can safely ignore this email.
`.trim();
}
