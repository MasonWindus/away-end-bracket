import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handleAuth } from "./handlers/auth";
import { handlePicks } from "./handlers/picks";
import { handleLeaderboard } from "./handlers/leaderboard";
import { handleAdmin, recalculateScoresBackground } from "./handlers/admin";
import { handleBugReport } from "./handlers/bugReport";
import { corsHeaders, corsPreflightResponse } from "./lib/middleware";

export const handler = async (
  event: unknown
): Promise<APIGatewayProxyResult> => {
  // Handle direct (non-API-Gateway) background task invocations
  const raw = event as Record<string, unknown>;
  if (raw.backgroundTask === "recalculate") {
    await recalculateScoresBackground();
    return { statusCode: 200, headers: {}, body: "" };
  }

  const apiEvent = event as APIGatewayProxyEvent;

  // Handle CORS preflight
  if (apiEvent.httpMethod === "OPTIONS") {
    return corsPreflightResponse();
  }

  const path = apiEvent.path;

  try {
    if (path.startsWith("/api/auth")) {
      return await handleAuth(apiEvent);
    }

    if (path.startsWith("/api/picks")) {
      return await handlePicks(apiEvent);
    }

    if (
      path.startsWith("/api/leaderboard") ||
      path.startsWith("/api/brackets") ||
      path.startsWith("/api/standings")
    ) {
      return await handleLeaderboard(apiEvent);
    }

    if (path.startsWith("/api/admin")) {
      return await handleAdmin(apiEvent);
    }

    if (path === "/api/bug-report") {
      return await handleBugReport(apiEvent);
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Not found" }),
    };
  } catch (err) {
    console.error("Unhandled error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
