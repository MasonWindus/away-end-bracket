import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import * as crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { getItem, putItem } from "../lib/db";
import {
  AuthError,
  clearSessionCookie,
  corsHeaders,
  createMagicLinkToken,
  createSessionToken,
  errorResponse,
  makeSessionCookie,
  requireAuth,
  response,
  verifyMagicLinkToken,
} from "../lib/middleware";
import { sendMagicLinkEmail, sendRegistrationEmail } from "../lib/email";
import { containsProfanity } from "../lib/profanity";
import { EmailLookupItem, MagicTokenItem, UserItem } from "../types";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function handleAuth(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  try {
    if (method === "POST" && path === "/api/auth/register") {
      return await register(event);
    }
    if (method === "POST" && path === "/api/auth/magic-link") {
      return await requestMagicLink(event);
    }
    if (method === "GET" && path === "/api/auth/verify") {
      return await verifyMagicLink(event);
    }
    if (method === "GET" && path === "/api/auth/me") {
      return await getMe(event);
    }
    if (method === "POST" && path === "/api/auth/logout") {
      return await logout(event);
    }

    return errorResponse(404, "Not found");
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.statusCode, err.message);
    }
    console.error("Auth error:", err);
    return errorResponse(500, "Internal server error");
  }
}

async function register(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  let body: { display_name?: string; email?: string };
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }

  const { display_name, email } = body;
  if (!display_name || !email) {
    return errorResponse(400, "display_name and email are required");
  }

  const emailNormalized = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
    return errorResponse(400, "Invalid email address");
  }

  if (display_name.trim().length < 2 || display_name.trim().length > 50) {
    return errorResponse(400, "display_name must be between 2 and 50 characters");
  }

  if (containsProfanity(display_name)) {
    return errorResponse(400, "display_name contains inappropriate language");
  }

  // Check if email already exists
  const existingLookup = await getItem({
    PK: `EMAIL#${emailNormalized}`,
    SK: "PROFILE",
  });

  if (existingLookup) {
    return errorResponse(409, "An account with this email already exists");
  }

  // Reserve a user ID but don't create the record yet — it will be created
  // when the user clicks the magic link and confirms their email address.
  const userId = uuidv4();

  const token = createMagicLinkToken(userId, emailNormalized);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const magicTokenItem: MagicTokenItem = {
    PK: `TOKEN#${tokenHash}`,
    SK: "TOKEN",
    user_id: userId,
    expires_at: expiresAt,
    used: false,
    pending_registration: true,
    display_name: display_name.trim(),
    email: emailNormalized,
  };

  await putItem(magicTokenItem as unknown as Record<string, unknown>);

  await sendRegistrationEmail(emailNormalized, display_name.trim(), token);

  return response(201, {
    message: "Check your email for the sign-in link.",
  });
}

async function requestMagicLink(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  let body: { email?: string };
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }

  const { email } = body;
  if (!email) {
    return errorResponse(400, "email is required");
  }

  const emailNormalized = email.toLowerCase().trim();

  // Look up user by email
  const emailLookup = await getItem({
    PK: `EMAIL#${emailNormalized}`,
    SK: "PROFILE",
  }) as EmailLookupItem | undefined;

  // Always return success to prevent email enumeration
  if (!emailLookup) {
    return response(200, { message: "If that email is registered, you will receive a sign-in link." });
  }

  const userItem = await getItem({
    PK: `USER#${emailLookup.user_id}`,
    SK: `USER#${emailLookup.user_id}`,
  }) as UserItem | undefined;

  if (!userItem) {
    return response(200, { message: "If that email is registered, you will receive a sign-in link." });
  }

  // Create magic link token
  const token = createMagicLinkToken(emailLookup.user_id, emailNormalized);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const magicTokenItem: MagicTokenItem = {
    PK: `TOKEN#${tokenHash}`,
    SK: "TOKEN",
    user_id: emailLookup.user_id,
    expires_at: expiresAt,
    used: false,
  };

  await putItem(magicTokenItem as unknown as Record<string, unknown>);

  await sendMagicLinkEmail(emailNormalized, userItem.display_name, token);

  return response(200, { message: "If that email is registered, you will receive a sign-in link." });
}

async function verifyMagicLink(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const token = event.queryStringParameters?.["token"];
  if (!token) {
    return errorResponse(400, "token query parameter is required");
  }

  // Verify JWT
  let payload: { userId: string; email: string };
  try {
    payload = verifyMagicLinkToken(token);
  } catch {
    return errorResponse(400, "Invalid or expired magic link.");
  }

  // Check token in DynamoDB (to ensure single-use)
  const tokenHash = hashToken(token);
  const tokenItem = await getItem({
    PK: `TOKEN#${tokenHash}`,
    SK: "TOKEN",
  }) as MagicTokenItem | undefined;

  if (!tokenItem) {
    return errorResponse(400, "Invalid or expired magic link.");
  }

  if (tokenItem.used) {
    return errorResponse(400, "This link has already been used. Please request a new one.");
  }

  if (new Date(tokenItem.expires_at) < new Date()) {
    return errorResponse(400, "This link has expired. Please request a new one.");
  }

  // Mark token as used
  await putItem({
    ...tokenItem,
    used: true,
  } as unknown as Record<string, unknown>);

  // If this is a pending registration, create the user record now that the
  // email address has been confirmed via the magic link.
  if (tokenItem.pending_registration) {
    if (!tokenItem.display_name || !tokenItem.email) {
      return errorResponse(400, "Invalid or expired magic link.");
    }

    const now = new Date().toISOString();
    const userItem: UserItem = {
      PK: `USER#${payload.userId}`,
      SK: `USER#${payload.userId}`,
      GSI1PK: "USERS",
      GSI1SK: 0,
      id: payload.userId,
      display_name: tokenItem.display_name,
      email: tokenItem.email,
      is_admin: false,
      created_at: now,
    };

    const emailLookup: EmailLookupItem = {
      PK: `EMAIL#${tokenItem.email}`,
      SK: "PROFILE",
      user_id: payload.userId,
    };

    await putItem(userItem as unknown as Record<string, unknown>);
    await putItem(emailLookup as unknown as Record<string, unknown>);
  }

  // Get user to check admin status
  const userItem = await getItem({
    PK: `USER#${payload.userId}`,
    SK: `USER#${payload.userId}`,
  }) as UserItem | undefined;

  if (!userItem) {
    return errorResponse(500, "Account not found. Please contact support.");
  }

  // Create session token
  const sessionToken = createSessionToken(
    payload.userId,
    payload.email,
    userItem.is_admin
  );

  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      "Set-Cookie": makeSessionCookie(sessionToken),
    },
    body: JSON.stringify({ success: true }),
  };
}

async function getMe(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = requireAuth(event);

  const userItem = await getItem({
    PK: `USER#${auth.userId}`,
    SK: `USER#${auth.userId}`,
  }) as UserItem | undefined;

  if (!userItem) {
    return errorResponse(404, "User not found");
  }

  return response(200, {
    id: userItem.id,
    display_name: userItem.display_name,
    email: userItem.email,
    is_admin: userItem.is_admin,
    created_at: userItem.created_at,
  });
}

async function logout(
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      "Set-Cookie": clearSessionCookie(),
    },
    body: JSON.stringify({ message: "Logged out successfully" }),
  };
}
