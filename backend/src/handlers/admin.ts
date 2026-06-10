import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { deleteItem, getItem, putItem, queryItems, scanItems, updateItem } from "../lib/db";
import { AuthError, errorResponse, requireAdmin, response } from "../lib/middleware";
import { calculateAllScores } from "../lib/scoring";
import { computeGroupStandings } from "../lib/standings";
import {
  BugReport,
  BugReportItem,
  GroupCode,
  GroupPickItem,
  GroupResultItem,
  KnockoutPicksItem,
  KnockoutResultItem,
  MatchResult,
  MatchResultItem,
  ScoreBreakdown,
  ScoresItem,
  ThirdsPickItem,
  ThirdsResultItem,
  UserItem,
  GroupPick,
  GroupResult,
  KnockoutPicks,
  KnockoutResult,
  ThirdsResult,
} from "../types";
import { GROUPS } from "../data/teams";

const GROUP_CODES: GroupCode[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
];

function isValidGroupCode(code: string): code is GroupCode {
  return GROUP_CODES.includes(code as GroupCode);
}

export async function handleAdmin(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  try {
    requireAdmin(event);

    // POST /api/admin/results/groups/:code
    const groupResultMatch = path.match(/^\/api\/admin\/results\/groups\/([A-L])$/);
    if (method === "POST" && groupResultMatch) {
      const code = groupResultMatch[1];
      if (!isValidGroupCode(code)) {
        return errorResponse(400, `Invalid group code: ${code}`);
      }
      return await postGroupResult(event, code);
    }

    // GET /api/admin/results/groups
    if (method === "GET" && path === "/api/admin/results/groups") {
      return await getAllGroupResults();
    }

    // POST /api/admin/results/thirds
    if (method === "POST" && path === "/api/admin/results/thirds") {
      return await postThirdsResult(event);
    }

    // POST /api/admin/results/knockout
    if (method === "POST" && path === "/api/admin/results/knockout") {
      return await postKnockoutResult(event);
    }

    // POST /api/admin/recalculate
    if (method === "POST" && path === "/api/admin/recalculate") {
      return await recalculateScores();
    }

    // GET /api/admin/users
    if (method === "GET" && path === "/api/admin/users") {
      return await getUsers(event);
    }

    // GET /api/admin/matches
    if (method === "GET" && path === "/api/admin/matches") {
      return await getMatches();
    }

    // POST /api/admin/matches
    if (method === "POST" && path === "/api/admin/matches") {
      return await postMatch(event);
    }

    // DELETE /api/admin/matches/:matchId
    const deleteMatchMatch = path.match(/^\/api\/admin\/matches\/(.+)$/);
    if (method === "DELETE" && deleteMatchMatch) {
      return await deleteMatch(decodeURIComponent(deleteMatchMatch[1]));
    }

    // POST /api/admin/users/:userId/pin
    const pinMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/pin$/);
    if (method === "POST" && pinMatch) {
      return await pinUser(pinMatch[1]);
    }

    // DELETE /api/admin/users/:userId/pin
    if (method === "DELETE" && pinMatch) {
      return await unpinUser(pinMatch[1]);
    }

    // GET /api/admin/bug-reports
    if (method === "GET" && path === "/api/admin/bug-reports") {
      return await getBugReports();
    }

    // PUT /api/admin/bug-reports/:id/status
    const bugReportStatusMatch = path.match(/^\/api\/admin\/bug-reports\/([^/]+)\/status$/);
    if (method === "PUT" && bugReportStatusMatch) {
      return await updateBugReportStatus(event, bugReportStatusMatch[1]);
    }

    // GET /api/admin/config/knockout-deadline
    if (method === "GET" && path === "/api/admin/config/knockout-deadline") {
      return await getKnockoutDeadlineConfig();
    }

    // PUT /api/admin/config/knockout-deadline
    if (method === "PUT" && path === "/api/admin/config/knockout-deadline") {
      return await putKnockoutDeadlineConfig(event);
    }

    return errorResponse(404, "Not found");
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.statusCode, err.message);
    }
    console.error("Admin error:", err);
    return errorResponse(500, "Internal server error");
  }
}

async function postGroupResult(
  event: APIGatewayProxyEvent,
  groupCode: GroupCode
): Promise<APIGatewayProxyResult> {
  let body: {
    first_place?: string;
    second_place?: string;
    third_place?: string;
    fourth_place?: string;
  };
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }

  const { first_place, second_place, third_place, fourth_place } = body;
  if (!first_place || !second_place || !third_place || !fourth_place) {
    return errorResponse(
      400,
      "first_place, second_place, third_place, and fourth_place are all required"
    );
  }

  // Validate teams belong to this group
  const groupTeams = GROUPS[groupCode].map((t) => t.code);
  const submitted = [first_place, second_place, third_place, fourth_place];
  const uniqueSubmitted = new Set(submitted);

  if (uniqueSubmitted.size !== 4) {
    return errorResponse(400, "All four positions must have distinct teams");
  }

  for (const team of submitted) {
    if (!groupTeams.includes(team)) {
      return errorResponse(400, `Team ${team} is not in group ${groupCode}`);
    }
  }

  const now = new Date().toISOString();
  const resultItem: GroupResultItem = {
    PK: `RESULT#GROUP#${groupCode}`,
    SK: "RESULT",
    group_code: groupCode,
    first_place,
    second_place,
    third_place,
    fourth_place,
    entered_at: now,
  };

  await putItem(resultItem as unknown as Record<string, unknown>);

  return response(200, {
    result: {
      group_code: groupCode,
      first_place,
      second_place,
      third_place,
      fourth_place,
      entered_at: now,
    },
  });
}

async function getAllGroupResults(): Promise<APIGatewayProxyResult> {
  const results = await Promise.all(
    GROUP_CODES.map(async (code) => {
      const item = await getItem({
        PK: `RESULT#GROUP#${code}`,
        SK: "RESULT",
      }) as GroupResultItem | undefined;

      if (!item) return null;

      return {
        group_code: item.group_code,
        first_place: item.first_place,
        second_place: item.second_place,
        third_place: item.third_place,
        fourth_place: item.fourth_place,
        entered_at: item.entered_at,
      };
    })
  );

  return response(200, { results: results.filter(Boolean) });
}

async function postThirdsResult(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  let body: { qualified_thirds?: string[]; bracket_slots?: Record<string, string> };
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }

  const { qualified_thirds, bracket_slots } = body;
  if (!qualified_thirds || !Array.isArray(qualified_thirds) || qualified_thirds.length !== 8) {
    return errorResponse(400, "qualified_thirds must be an array of exactly 8 team codes");
  }

  if (!bracket_slots || typeof bracket_slots !== "object" || Array.isArray(bracket_slots)) {
    return errorResponse(400, "bracket_slots must be an object mapping slot numbers to team codes");
  }

  // Validate all qualified thirds are real team codes
  const allTeamCodes = new Set(
    Object.values(GROUPS)
      .flat()
      .map((t) => t.code)
  );
  for (const team of qualified_thirds) {
    if (!allTeamCodes.has(team)) {
      return errorResponse(400, `Unknown team code: ${team}`);
    }
  }

  // Validate uniqueness
  const uniqueThirds = new Set(qualified_thirds);
  if (uniqueThirds.size !== 8) {
    return errorResponse(400, "All 8 qualified thirds must be distinct");
  }

  const now = new Date().toISOString();
  const thirdsResultItem: ThirdsResultItem = {
    PK: "RESULT#THIRDS",
    SK: "RESULT",
    qualified_thirds,
    bracket_slots,
    entered_at: now,
  };

  await putItem(thirdsResultItem as unknown as Record<string, unknown>);

  return response(200, {
    result: { qualified_thirds, bracket_slots, entered_at: now },
  });
}

async function postKnockoutResult(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  let body: {
    R32Winners?: string[];
    R16Winners?: string[];
    QFWinners?: string[];
    SFWinners?: string[];
    champion?: string;
  };
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }

  const { R32Winners, R16Winners, QFWinners, SFWinners, champion } = body;

  if (!R32Winners || !Array.isArray(R32Winners) || R32Winners.length !== 16) {
    return errorResponse(400, "R32Winners must be an array of exactly 16 teams");
  }
  if (!R16Winners || !Array.isArray(R16Winners) || R16Winners.length !== 8) {
    return errorResponse(400, "R16Winners must be an array of exactly 8 teams");
  }
  if (!QFWinners || !Array.isArray(QFWinners) || QFWinners.length !== 4) {
    return errorResponse(400, "QFWinners must be an array of exactly 4 teams");
  }
  if (!SFWinners || !Array.isArray(SFWinners) || SFWinners.length !== 2) {
    return errorResponse(400, "SFWinners must be an array of exactly 2 teams");
  }
  if (!champion || typeof champion !== "string") {
    return errorResponse(400, "champion must be a single team code string");
  }

  if (!SFWinners.includes(champion)) {
    return errorResponse(400, "champion must be one of the two SF winners");
  }

  const now = new Date().toISOString();
  const knockoutResultItem: KnockoutResultItem = {
    PK: "RESULT#KNOCKOUT",
    SK: "RESULT",
    R32Winners,
    R16Winners,
    QFWinners,
    SFWinners,
    champion,
    entered_at: now,
  };

  await putItem(knockoutResultItem as unknown as Record<string, unknown>);

  return response(200, {
    result: { R32Winners, R16Winners, QFWinners, SFWinners, champion, entered_at: now },
  });
}

async function recalculateScores(): Promise<APIGatewayProxyResult> {
  // Fetch all results + match results in parallel
  const [allGroupResultsArr, thirdsResultRaw, knockoutResultRaw, allMatchItems] = await Promise.all([
    Promise.all(
      GROUP_CODES.map((code) =>
        getItem({ PK: `RESULT#GROUP#${code}`, SK: "RESULT" })
      )
    ),
    getItem({ PK: "RESULT#THIRDS", SK: "RESULT" }),
    getItem({ PK: "RESULT#KNOCKOUT", SK: "RESULT" }),
    scanItems({
      FilterExpression: "begins_with(PK, :prefix)",
      ExpressionAttributeValues: { ":prefix": "MATCH#GROUP#" },
    }),
  ]);

  // Build final results map, filling gaps with provisional standings from matches
  const matchesByGroup = (allMatchItems as unknown as MatchResultItem[]).reduce<Record<GroupCode, MatchResult[]>>(
    (acc, item) => {
      const code = item.group_code;
      if (!acc[code]) acc[code] = [];
      acc[code].push(item as unknown as MatchResult);
      return acc;
    },
    {} as Record<GroupCode, MatchResult[]>
  );

  const allGroupResults = GROUP_CODES.reduce<Record<GroupCode, GroupResult>>(
    (acc, code, idx) => {
      const raw = allGroupResultsArr[idx];
      if (raw) {
        acc[code] = raw as unknown as GroupResult;
      } else {
        const provisional = computeGroupStandings(code, matchesByGroup[code] ?? []);
        if (provisional) acc[code] = provisional;
      }
      return acc;
    },
    {} as Record<GroupCode, GroupResult>
  );

  const thirdsResult = thirdsResultRaw as unknown as ThirdsResult | null;
  const knockoutResult = knockoutResultRaw as unknown as KnockoutResult | null;

  // Scan all USER items
  const userItems = await scanItems({
    FilterExpression: "begins_with(PK, :prefix) AND SK = PK",
    ExpressionAttributeValues: {
      ":prefix": "USER#",
    },
  }) as unknown as UserItem[];

  let processed = 0;

  for (const user of userItems) {
    try {
      const userId = user.id;

      // Fetch all picks for this user
      const [groupPickItems, thirdsPickRaw, knockoutPickRaw] = await Promise.all([
        queryItems({
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": `USER#${userId}`,
            ":skPrefix": "PICK#GROUP#",
          },
        }),
        getItem({ PK: `USER#${userId}`, SK: "PICK#THIRDS" }),
        getItem({ PK: `USER#${userId}`, SK: "PICK#KNOCKOUT" }),
      ]);

      // Build group picks map
      const allGroupPicks = GROUP_CODES.reduce<Record<GroupCode, GroupPick>>(
        (acc, code) => {
          const found = (groupPickItems as unknown as GroupPickItem[]).find(
            (item) => item.SK === `PICK#GROUP#${code}`
          );
          if (found) {
            acc[code] = found as unknown as GroupPick;
          }
          return acc;
        },
        {} as Record<GroupCode, GroupPick>
      );

      const thirdsPick = thirdsPickRaw as unknown as ThirdsPickItem | null;
      const thirdsList = thirdsPick?.teams ?? [];
      const knockoutPick = knockoutPickRaw as unknown as KnockoutPicks | null;

      // Calculate scores
      const breakdown: ScoreBreakdown = calculateAllScores(
        allGroupPicks,
        thirdsList,
        knockoutPick,
        allGroupResults,
        thirdsResult,
        knockoutResult
      );

      const now = new Date().toISOString();

      // Save scores item
      const scoresItem: ScoresItem = {
        PK: `USER#${userId}`,
        SK: "SCORES",
        group_stage_score: breakdown.group_stage_total,
        knockout_score: breakdown.knockout_total,
        total_score: breakdown.total,
        breakdown,
        last_calculated: now,
      };
      await putItem(scoresItem as unknown as Record<string, unknown>);

      // Update user item's GSI1SK (for leaderboard ordering)
      await updateItem({
        Key: {
          PK: `USER#${userId}`,
          SK: `USER#${userId}`,
        },
        UpdateExpression: "SET GSI1SK = :score",
        ExpressionAttributeValues: {
          ":score": breakdown.total,
        },
      });

      processed++;
    } catch (userErr) {
      console.error(`Error processing user ${user.id}:`, userErr);
    }
  }

  return response(200, { processed });
}

async function getMatches(): Promise<APIGatewayProxyResult> {
  const items = await scanItems({
    FilterExpression: "begins_with(PK, :prefix)",
    ExpressionAttributeValues: { ":prefix": "MATCH#GROUP#" },
  }) as unknown as MatchResultItem[];

  const matches = items.map((item) => ({
    match_id: item.match_id,
    group_code: item.group_code,
    home_team: item.home_team,
    away_team: item.away_team,
    home_goals: item.home_goals,
    away_goals: item.away_goals,
    entered_at: item.entered_at,
  }));

  matches.sort((a, b) => a.group_code.localeCompare(b.group_code) || a.match_id.localeCompare(b.match_id));

  return response(200, { matches });
}

async function postMatch(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  let body: {
    group_code?: string;
    home_team?: string;
    away_team?: string;
    home_goals?: number;
    away_goals?: number;
  };
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }

  const { group_code, home_team, away_team } = body;
  const home_goals = body.home_goals;
  const away_goals = body.away_goals;

  if (!group_code || !isValidGroupCode(group_code)) {
    return errorResponse(400, "Valid group_code (A–L) is required");
  }
  if (!home_team || !away_team) {
    return errorResponse(400, "home_team and away_team are required");
  }
  if (home_team === away_team) {
    return errorResponse(400, "home_team and away_team must be different");
  }
  if (typeof home_goals !== "number" || typeof away_goals !== "number" ||
      !Number.isInteger(home_goals) || !Number.isInteger(away_goals) ||
      home_goals < 0 || away_goals < 0) {
    return errorResponse(400, "home_goals and away_goals must be non-negative integers");
  }

  const groupTeams = GROUPS[group_code as GroupCode].map((t) => t.code);
  if (!groupTeams.includes(home_team) || !groupTeams.includes(away_team)) {
    return errorResponse(400, `Both teams must belong to group ${group_code}`);
  }

  // Deterministic match_id regardless of which team is "home" in the lookup
  const [t1, t2] = [home_team, away_team].sort();
  const match_id = `${group_code}_${t1}_${t2}`;
  const now = new Date().toISOString();

  const item: MatchResultItem = {
    PK: `MATCH#GROUP#${group_code}`,
    SK: `MATCH#${match_id}`,
    match_id,
    group_code: group_code as GroupCode,
    home_team,
    away_team,
    home_goals,
    away_goals,
    entered_at: now,
  };

  await putItem(item as unknown as Record<string, unknown>);

  return response(200, {
    match: { match_id, group_code, home_team, away_team, home_goals, away_goals, entered_at: now },
  });
}

async function deleteMatch(matchId: string): Promise<APIGatewayProxyResult> {
  // match_id format: "{group}_{t1}_{t2}"
  const parts = matchId.split("_");
  if (parts.length < 3) {
    return errorResponse(400, "Invalid match_id format");
  }
  const group_code = parts[0];
  if (!isValidGroupCode(group_code)) {
    return errorResponse(400, "Invalid group code in match_id");
  }

  await deleteItem({
    PK: `MATCH#GROUP#${group_code}`,
    SK: `MATCH#${matchId}`,
  });

  return response(200, { message: "Match result deleted" });
}

async function pinUser(userId: string): Promise<APIGatewayProxyResult> {
  const userItem = await getItem({ PK: `USER#${userId}`, SK: `USER#${userId}` }) as UserItem | undefined;
  if (!userItem) return errorResponse(404, "User not found");

  await updateItem({
    Key: { PK: `USER#${userId}`, SK: `USER#${userId}` },
    UpdateExpression: "SET is_pinned = :val",
    ExpressionAttributeValues: { ":val": true },
  });

  return response(200, { message: "User pinned" });
}

async function unpinUser(userId: string): Promise<APIGatewayProxyResult> {
  const userItem = await getItem({ PK: `USER#${userId}`, SK: `USER#${userId}` }) as UserItem | undefined;
  if (!userItem) return errorResponse(404, "User not found");

  await updateItem({
    Key: { PK: `USER#${userId}`, SK: `USER#${userId}` },
    UpdateExpression: "REMOVE is_pinned",
  });

  return response(200, { message: "User unpinned" });
}

async function getBugReports(): Promise<APIGatewayProxyResult> {
  const items = await queryItems({
    IndexName: "GSI1",
    KeyConditionExpression: "GSI1PK = :pk",
    ExpressionAttributeValues: { ":pk": "BUG_REPORTS" },
    ScanIndexForward: false, // newest first
  }) as unknown as BugReportItem[];

  const reports: BugReport[] = items.map((item) => ({
    id: item.id,
    description: item.description,
    ...(item.page ? { page: item.page } : {}),
    ...(item.user_id ? { user_id: item.user_id } : {}),
    ...(item.display_name ? { display_name: item.display_name } : {}),
    status: item.status,
    created_at: item.created_at,
  }));

  return response(200, { reports });
}

async function updateBugReportStatus(
  event: APIGatewayProxyEvent,
  id: string
): Promise<APIGatewayProxyResult> {
  let body: { status?: string };
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return errorResponse(400, "Invalid JSON");
  }

  if (body.status !== "open" && body.status !== "resolved") {
    return errorResponse(400, "status must be 'open' or 'resolved'");
  }

  await updateItem({
    Key: { PK: `BUG_REPORT#${id}`, SK: "REPORT" },
    UpdateExpression: "SET #s = :status",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":status": body.status },
  });

  return response(200, { message: "Status updated" });
}

async function getKnockoutDeadlineConfig(): Promise<APIGatewayProxyResult> {
  const item = await getItem({ PK: "CONFIG#KNOCKOUT_DEADLINE", SK: "CONFIG" });
  return response(200, { deadline: item ? (item.value as string) : null });
}

async function putKnockoutDeadlineConfig(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  let body: { deadline?: string | null };
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }

  if (!("deadline" in body)) {
    return errorResponse(400, "deadline is required (use null to clear)");
  }

  const { deadline } = body;

  if (deadline !== null && deadline !== undefined) {
    const d = new Date(deadline);
    if (isNaN(d.getTime())) {
      return errorResponse(400, "Invalid deadline format. Use ISO 8601 (e.g. 2026-06-28T16:00:00Z)");
    }
    await putItem({ PK: "CONFIG#KNOCKOUT_DEADLINE", SK: "CONFIG", value: deadline });
  } else {
    await deleteItem({ PK: "CONFIG#KNOCKOUT_DEADLINE", SK: "CONFIG" });
  }

  return response(200, { deadline: deadline ?? null });
}

async function getUsers(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const qs = event.queryStringParameters ?? {};
  const page = Math.max(1, parseInt(qs.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit ?? "50", 10) || 50));

  const allUserItems = await scanItems({
    FilterExpression: "begins_with(PK, :prefix) AND SK = PK",
    ExpressionAttributeValues: {
      ":prefix": "USER#",
    },
  }) as unknown as UserItem[];

  // Pinned users first, then alphabetically
  allUserItems.sort((a, b) => {
    if ((b.is_pinned ? 1 : 0) !== (a.is_pinned ? 1 : 0)) return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
    return (a.display_name ?? "").localeCompare(b.display_name ?? "");
  });

  const total = allUserItems.length;
  const pageItems = allUserItems.slice((page - 1) * limit, page * limit);

  const usersWithStatus = await Promise.all(
    pageItems.map(async (user) => {
      const userId = user.id;

      const [groupPickItems, thirdsPickRaw, knockoutPickRaw, scoresRaw] =
        await Promise.all([
          queryItems({
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
            ExpressionAttributeValues: {
              ":pk": `USER#${userId}`,
              ":skPrefix": "PICK#GROUP#",
            },
          }),
          getItem({ PK: `USER#${userId}`, SK: "PICK#THIRDS" }),
          getItem({ PK: `USER#${userId}`, SK: "PICK#KNOCKOUT" }),
          getItem({ PK: `USER#${userId}`, SK: "SCORES" }),
        ]);

      const groupsComplete = groupPickItems.length === 12;
      const thirdsComplete = !!(thirdsPickRaw as ThirdsPickItem | undefined)?.teams?.length;
      const knockoutComplete = !!(knockoutPickRaw as KnockoutPicksItem | undefined)?.Champion;
      const scoresItem = scoresRaw as ScoresItem | undefined;

      return {
        id: user.id,
        display_name: user.display_name,
        email: user.email,
        is_admin: user.is_admin,
        is_pinned: user.is_pinned ?? false,
        has_group_picks: groupsComplete,
        has_thirds_picks: thirdsComplete,
        has_knockout_picks: knockoutComplete,
        total_score: scoresItem?.total_score ?? 0,
      };
    })
  );

  return response(200, { users: usersWithStatus, total, page, limit });
}
