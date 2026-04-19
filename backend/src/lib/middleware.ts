import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "changeme";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": FRONTEND_URL,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

export interface AuthContext {
  userId: string;
  email: string;
  isAdmin: boolean;
}

export interface SessionPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
  type: "session";
}

export interface MagicLinkPayload {
  userId: string;
  email: string;
  type: "magic-link";
}

function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(";").reduce<Record<string, string>>((acc, cookie) => {
    const [key, ...rest] = cookie.trim().split("=");
    if (key) {
      acc[key.trim()] = rest.join("=").trim();
    }
    return acc;
  }, {});
}

function getSessionToken(event: APIGatewayProxyEvent): string | null {
  const cookieHeader = event.headers["Cookie"] || event.headers["cookie"] || "";
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    if (cookies["session"]) {
      return cookies["session"];
    }
  }

  // Also check Authorization header as fallback
  const authHeader = event.headers["Authorization"] || event.headers["authorization"] || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}

export function requireAuth(event: APIGatewayProxyEvent): AuthContext {
  const token = getSessionToken(event);
  if (!token) {
    throw new AuthError("No session token provided", 401);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload;
    if (decoded.type !== "session") {
      throw new AuthError("Invalid token type", 401);
    }
    return {
      userId: decoded.userId,
      email: decoded.email,
      isAdmin: decoded.isAdmin,
    };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError("Invalid or expired session token", 401);
  }
}

export function requireAdmin(event: APIGatewayProxyEvent): AuthContext {
  const auth = requireAuth(event);
  if (!auth.isAdmin) {
    throw new AuthError("Admin access required", 403);
  }
  return auth;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function response(
  statusCode: number,
  body: unknown,
  extraHeaders?: Record<string, string>
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

export function errorResponse(
  statusCode: number,
  message: string,
  extraHeaders?: Record<string, string>
): APIGatewayProxyResult {
  return response(statusCode, { error: message }, extraHeaders);
}

export function corsPreflightResponse(): APIGatewayProxyResult {
  return {
    statusCode: 204,
    headers: corsHeaders,
    body: "",
  };
}

export function createSessionToken(
  userId: string,
  email: string,
  isAdmin: boolean
): string {
  const payload: SessionPayload = { userId, email, isAdmin, type: "session" };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function createMagicLinkToken(userId: string, email: string): string {
  const payload: MagicLinkPayload = { userId, email, type: "magic-link" };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

export function verifyMagicLinkToken(token: string): MagicLinkPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as MagicLinkPayload;
    if (decoded.type !== "magic-link") {
      throw new AuthError("Invalid token type", 401);
    }
    return decoded;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError("Invalid or expired magic link token", 401);
  }
}

export function makeSessionCookie(token: string): string {
  const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds
  return `session=${token}; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}; Path=/`;
}

export function clearSessionCookie(): string {
  return `session=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/`;
}
