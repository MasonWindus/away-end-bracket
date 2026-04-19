import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getItem, putItem, queryItems, scanItems, updateItem } from "../lib/db";
import { AuthError, errorResponse, requireAdmin, response } from "../lib/middleware";
import { calculateAllScores } from "../lib/scoring";
import {
  GroupCode,
  GroupPickItem,
  GroupResultItem,
  KnockoutPicksItem,
  KnockoutResultItem,
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
      return await getUsers();
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
  // Fetch all results first
  const [allGroupResultsArr, thirdsResultRaw, knockoutResultRaw] = await Promise.all([
    Promise.all(
      GROUP_CODES.map((code) =>
        getItem({ PK: `RESULT#GROUP#${code}`, SK: "RESULT" })
      )
    ),
    getItem({ PK: "RESULT#THIRDS", SK: "RESULT" }),
    getItem({ PK: "RESULT#KNOCKOUT", SK: "RESULT" }),
  ]);

  const allGroupResults = GROUP_CODES.reduce<Record<GroupCode, GroupResult>>(
    (acc, code, idx) => {
      const raw = allGroupResultsArr[idx];
      if (raw) acc[code] = raw as unknown as GroupResult;
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

async function getUsers(): Promise<APIGatewayProxyResult> {
  // Scan all USER items
  const userItems = await scanItems({
    FilterExpression: "begins_with(PK, :prefix) AND SK = PK",
    ExpressionAttributeValues: {
      ":prefix": "USER#",
    },
  }) as unknown as UserItem[];

  const usersWithStatus = await Promise.all(
    userItems.map(async (user) => {
      const userId = user.id;

      // Check picks status in parallel
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
        picks_status: {
          groups_complete: groupsComplete,
          thirds_complete: thirdsComplete,
          knockout_complete: knockoutComplete,
        },
        total_score: scoresItem?.total_score ?? 0,
      };
    })
  );

  return response(200, { users: usersWithStatus });
}
