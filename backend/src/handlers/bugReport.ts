import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { putItem } from "../lib/db";
import { AuthError, errorResponse, requireAuth, response } from "../lib/middleware";
import { BugReportItem } from "../types";

export async function handleBugReport(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (event.httpMethod !== "POST" || event.path !== "/api/bug-report") {
    return errorResponse(404, "Not found");
  }

  let body: { description?: string; page?: string };
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return errorResponse(400, "Invalid JSON");
  }

  const description = (body.description || "").trim();
  if (!description) {
    return errorResponse(400, "Description is required");
  }
  if (description.length > 2000) {
    return errorResponse(400, "Description must be 2000 characters or less");
  }

  // Capture user identity if logged in, but don't require it
  let userId: string | undefined;
  let displayName: string | undefined;
  try {
    const auth = requireAuth(event);
    userId = auth.userId;
    // Fetch display name from the auth context email isn't enough; skip for now
    // userId is sufficient for admin to look up if needed
  } catch (err) {
    if (!(err instanceof AuthError)) throw err;
  }

  const id = uuidv4();
  const now = new Date();

  const item: BugReportItem = {
    PK: `BUG_REPORT#${id}`,
    SK: "REPORT",
    GSI1PK: "BUG_REPORTS",
    GSI1SK: now.getTime(),
    id,
    description,
    ...(body.page ? { page: body.page.slice(0, 200) } : {}),
    ...(userId ? { user_id: userId } : {}),
    ...(displayName ? { display_name: displayName } : {}),
    status: "open",
    created_at: now.toISOString(),
  };

  await putItem(item as unknown as Record<string, unknown>);

  return response(201, { message: "Bug report submitted", id });
}
