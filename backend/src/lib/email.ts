import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesClient = new SESClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@example.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export async function sendMagicLinkEmail(
  toEmail: string,
  displayName: string,
  token: string
): Promise<void> {
  const magicLink = `${FRONTEND_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to The Away End</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
  <div style="background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a2e; margin-top: 0;">The Away End</h1>
    <h2 style="color: #16213e;">World Cup 2026 Bracket Contest</h2>
    <p style="color: #333333; font-size: 16px;">Hi ${displayName},</p>
    <p style="color: #333333; font-size: 16px;">Click the button below to sign in to your account. This link expires in 15 minutes.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${magicLink}"
         style="background-color: #e94560; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 18px; font-weight: bold; display: inline-block;">
        Sign In to The Away End
      </a>
    </div>
    <p style="color: #666666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="color: #666666; font-size: 13px; word-break: break-all;">${magicLink}</p>
    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 32px 0;">
    <p style="color: #999999; font-size: 12px;">If you didn't request this email, you can safely ignore it. This link will expire in 15 minutes.</p>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
Hi ${displayName},

Click the link below to sign in to The Away End - World Cup 2026 Bracket Contest.

${magicLink}

This link expires in 15 minutes. If you didn't request this email, you can safely ignore it.
  `.trim();

  const command = new SendEmailCommand({
    Source: `The Away End <${FROM_EMAIL}>`,
    Destination: {
      ToAddresses: [toEmail],
    },
    Message: {
      Subject: {
        Data: "Sign in to The Away End",
        Charset: "UTF-8",
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: "UTF-8",
        },
        Text: {
          Data: textBody,
          Charset: "UTF-8",
        },
      },
    },
  });

  await sesClient.send(command);
}

export async function sendRegistrationEmail(
  toEmail: string,
  displayName: string,
  token: string
): Promise<void> {
  const magicLink = `${FRONTEND_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to The Away End</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
  <div style="background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a2e; margin-top: 0;">Welcome to The Away End!</h1>
    <h2 style="color: #16213e;">World Cup 2026 Bracket Contest</h2>
    <p style="color: #333333; font-size: 16px;">Hi ${displayName},</p>
    <p style="color: #333333; font-size: 16px;">Your account has been created! Click the button below to sign in and start making your picks. This link expires in 15 minutes.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${magicLink}"
         style="background-color: #e94560; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 18px; font-weight: bold; display: inline-block;">
        Get Started - Sign In
      </a>
    </div>
    <p style="color: #666666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="color: #666666; font-size: 13px; word-break: break-all;">${magicLink}</p>
    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 32px 0;">
    <p style="color: #999999; font-size: 12px;">If you didn't create this account, you can safely ignore this email.</p>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
Welcome to The Away End - World Cup 2026 Bracket Contest!

Hi ${displayName},

Your account has been created! Click the link below to sign in and start making your picks.

${magicLink}

This link expires in 15 minutes. If you didn't create this account, you can safely ignore this email.
  `.trim();

  const command = new SendEmailCommand({
    Source: `The Away End <${FROM_EMAIL}>`,
    Destination: {
      ToAddresses: [toEmail],
    },
    Message: {
      Subject: {
        Data: "Welcome to The Away End - World Cup 2026 Bracket Contest",
        Charset: "UTF-8",
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: "UTF-8",
        },
        Text: {
          Data: textBody,
          Charset: "UTF-8",
        },
      },
    },
  });

  await sesClient.send(command);
}
