import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handleAuth } from "./handlers/auth";
import { handlePicks } from "./handlers/picks";
import { handleLeaderboard } from "./handlers/leaderboard";
import { handleAdmin } from "./handlers/admin";
import { handleBugReport } from "./handlers/bugReport";
import { corsHeaders, corsPreflightResponse } from "./lib/middleware";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return corsPreflightResponse();
  }

  const path = event.path;

  try {
    if (path.startsWith("/api/auth")) {
      return await handleAuth(event);
    }

    if (path.startsWith("/api/picks")) {
      return await handlePicks(event);
    }

    if (path.startsWith("/api/leaderboard") || path.startsWith("/api/brackets")) {
      return await handleLeaderboard(event);
    }

    if (path.startsWith("/api/admin")) {
      return await handleAdmin(event);
    }

    if (path === "/api/bug-report") {
      return await handleBugReport(event);
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
