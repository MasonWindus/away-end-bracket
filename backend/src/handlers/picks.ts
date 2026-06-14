import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { deleteItem, getItem, putItem, queryItems } from "../lib/db";
import {
  AuthError,
  errorResponse,
  requireAuth,
  response,
} from "../lib/middleware";
import {
  GroupCode,
  GroupPickItem,
  KnockoutPicksItem,
  PICKS_DEADLINE,
  ThirdsPickItem,
  UserItem,
} from "../types";
import { GROUPS } from "../data/teams";

const GROUP_CODES: GroupCode[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
];

function isDeadlinePassed(): boolean {
  return new Date() > new Date(PICKS_DEADLINE);
}

async function getKnockoutDeadlineConfig(): Promise<string | null> {
  const item = await getItem({ PK: "CONFIG#KNOCKOUT_DEADLINE", SK: "CONFIG" });
  return item ? (item.value as string) : null;
}

async function isKnockoutDeadlinePassed(): Promise<boolean> {
  const deadline = await getKnockoutDeadlineConfig();
  if (!deadline) return false;
  return new Date() > new Date(deadline);
}

async function isLateEntry(userId: string): Promise<boolean> {
  const userItem = await getItem({ PK: `USER#${userId}`, SK: `USER#${userId}` }) as UserItem | undefined;
  return userItem?.is_late_entry ?? false;
}

function isValidGroupCode(code: string): code is GroupCode {
  return GROUP_CODES.includes(code as GroupCode);
}

function validateGroupTeams(
  groupCode: GroupCode,
  first: string,
  second: string,
  third: string,
  fourth: string
): string | null {
  const groupTeams = GROUPS[groupCode].map((t) => t.code);
  const submitted = [first, second, third, fourth];

  // Check no duplicates
  const uniqueSubmitted = new Set(submitted);
  if (uniqueSubmitted.size !== 4) {
    return "All four positions must have distinct teams";
  }

  // Check all teams belong to this group
  for (const team of submitted) {
    if (!groupTeams.includes(team)) {
      return `Team ${team} is not in group ${groupCode}`;
    }
  }

  return null;
}

export async function handlePicks(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  try {
    // Public endpoint — no auth required
    if (method === "GET" && path === "/api/picks/knockout-deadline") {
      const deadline = await getKnockoutDeadlineConfig();
      const locked = deadline !== null && new Date() > new Date(deadline);
      return response(200, { deadline, locked });
    }

    const auth = requireAuth(event);

    // GET /api/picks/groups
    if (method === "GET" && path === "/api/picks/groups") {
      return await getGroupPicks(auth.userId);
    }

    // PUT /api/picks/groups/:code
    const groupPutMatch = path.match(/^\/api\/picks\/groups\/([A-L])$/);
    if (method === "PUT" && groupPutMatch) {
      const code = groupPutMatch[1];
      if (!isValidGroupCode(code)) {
        return errorResponse(400, `Invalid group code: ${code}`);
      }
      return await putGroupPick(event, auth.userId, code);
    }

    // GET /api/picks/thirds
    if (method === "GET" && path === "/api/picks/thirds") {
      return await getThirdsPick(auth.userId);
    }

    // PUT /api/picks/thirds
    if (method === "PUT" && path === "/api/picks/thirds") {
      return await putThirdsPick(event, auth.userId);
    }

    // GET /api/picks/knockout
    if (method === "GET" && path === "/api/picks/knockout") {
      return await getKnockoutPicks(auth.userId);
    }

    // PUT /api/picks/knockout
    if (method === "PUT" && path === "/api/picks/knockout") {
      return await putKnockoutPicks(event, auth.userId);
    }

    // DELETE /api/picks/knockout
    if (method === "DELETE" && path === "/api/picks/knockout") {
      return await deleteKnockoutPicks(auth.userId);
    }

    return errorResponse(404, "Not found");
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.statusCode, err.message);
    }
    console.error("Picks error:", err);
    return errorResponse(500, "Internal server error");
  }
}

async function getGroupPicks(userId: string): Promise<APIGatewayProxyResult> {
  const items = await queryItems({
    KeyConditionExpression:
      "PK = :pk AND begins_with(SK, :skPrefix)",
    ExpressionAttributeValues: {
      ":pk": `USER#${userId}`,
      ":skPrefix": "PICK#GROUP#",
    },
  });

  const picks: Record<string, unknown>[] = GROUP_CODES.map((code) => {
    const found = items.find(
      (item) => item["SK"] === `PICK#GROUP#${code}`
    ) as GroupPickItem | undefined;

    if (found) {
      return {
        group_code: found.group_code,
        first_place: found.first_place,
        second_place: found.second_place,
        third_place: found.third_place,
        fourth_place: found.fourth_place,
        locked: found.locked,
        submitted_at: found.submitted_at,
      };
    }

    return {
      group_code: code,
      first_place: null,
      second_place: null,
      third_place: null,
      fourth_place: null,
      locked: false,
      submitted_at: null,
    };
  });

  return response(200, { picks });
}

async function putGroupPick(
  event: APIGatewayProxyEvent,
  userId: string,
  groupCode: GroupCode
): Promise<APIGatewayProxyResult> {
  if (isDeadlinePassed() && !(await isLateEntry(userId))) {
    return errorResponse(403, "Picks are locked. The deadline has passed.");
  }

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

  const validationError = validateGroupTeams(
    groupCode,
    first_place,
    second_place,
    third_place,
    fourth_place
  );
  if (validationError) {
    return errorResponse(400, validationError);
  }

  const now = new Date().toISOString();
  const pickItem: GroupPickItem = {
    PK: `USER#${userId}`,
    SK: `PICK#GROUP#${groupCode}`,
    group_code: groupCode,
    first_place,
    second_place,
    third_place,
    fourth_place,
    locked: false,
    submitted_at: now,
  };

  await putItem(pickItem as unknown as Record<string, unknown>);

  return response(200, {
    pick: {
      group_code: groupCode,
      first_place,
      second_place,
      third_place,
      fourth_place,
      locked: false,
      submitted_at: now,
    },
  });
}

async function getThirdsPick(userId: string): Promise<APIGatewayProxyResult> {
  const item = await getItem({
    PK: `USER#${userId}`,
    SK: "PICK#THIRDS",
  }) as ThirdsPickItem | undefined;

  if (!item) {
    return response(200, { teams: [], locked: false, submitted_at: null });
  }

  return response(200, {
    teams: item.teams,
    locked: item.locked,
    submitted_at: item.submitted_at,
  });
}

async function putThirdsPick(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  if (isDeadlinePassed() && !(await isLateEntry(userId))) {
    return errorResponse(403, "Picks are locked. The deadline has passed.");
  }

  let body: { teams?: string[] };
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }

  const { teams } = body;
  if (!teams || !Array.isArray(teams)) {
    return errorResponse(400, "teams must be an array");
  }

  if (teams.length !== 8) {
    return errorResponse(400, "Exactly 8 teams must be selected for thirds");
  }

  // Check all teams are unique
  const uniqueTeams = new Set(teams);
  if (uniqueTeams.size !== 8) {
    return errorResponse(400, "All 8 teams must be distinct");
  }

  // Get all group picks to know which teams finished 3rd in their group pick
  // Teams must be valid team codes from any group
  const allTeamCodes = new Set(
    Object.values(GROUPS)
      .flat()
      .map((t) => t.code)
  );

  for (const team of teams) {
    if (!allTeamCodes.has(team)) {
      return errorResponse(400, `Unknown team code: ${team}`);
    }
  }

  // Each thirds pick must come from a different group
  // (a team can only be a third-place finisher in one group)
  const groupsRepresented = new Set<GroupCode>();
  for (const teamCode of teams) {
    for (const [groupCode, groupTeams] of Object.entries(GROUPS)) {
      if (groupTeams.some((t) => t.code === teamCode)) {
        if (groupsRepresented.has(groupCode as GroupCode)) {
          return errorResponse(
            400,
            `Cannot select two teams from group ${groupCode} as thirds`
          );
        }
        groupsRepresented.add(groupCode as GroupCode);
        break;
      }
    }
  }

  const now = new Date().toISOString();
  const thirdsItem: ThirdsPickItem = {
    PK: `USER#${userId}`,
    SK: "PICK#THIRDS",
    teams,
    locked: false,
    submitted_at: now,
  };

  await putItem(thirdsItem as unknown as Record<string, unknown>);

  return response(200, {
    teams,
    locked: false,
    submitted_at: now,
  });
}

async function getKnockoutPicks(userId: string): Promise<APIGatewayProxyResult> {
  const item = await getItem({
    PK: `USER#${userId}`,
    SK: "PICK#KNOCKOUT",
  }) as KnockoutPicksItem | undefined;

  if (!item) {
    return response(200, {
      R16: [],
      QF: [],
      SF: [],
      Final: [],
      Champion: null,
      locked: false,
      submitted_at: null,
    });
  }

  return response(200, {
    R16: item.R16,
    QF: item.QF,
    SF: item.SF,
    Final: item.Final,
    Champion: item.Champion,
    locked: item.locked,
    submitted_at: item.submitted_at,
  });
}

async function deleteKnockoutPicks(userId: string): Promise<APIGatewayProxyResult> {
  if ((await isKnockoutDeadlinePassed()) && !(await isLateEntry(userId))) {
    return errorResponse(403, "Knockout picks are locked. The deadline has passed.");
  }
  await deleteItem({ PK: `USER#${userId}`, SK: "PICK#KNOCKOUT" });
  return response(200, { message: "Knockout picks cleared" });
}

async function putKnockoutPicks(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  if ((await isKnockoutDeadlinePassed()) && !(await isLateEntry(userId))) {
    return errorResponse(403, "Knockout picks are locked. The deadline has passed.");
  }

  let body: {
    R16?: string[];
    QF?: string[];
    SF?: string[];
    Final?: string[];
    Champion?: string;
  };
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }

  const { R16, QF, SF, Final, Champion } = body;

  if (!R16 || !Array.isArray(R16) || R16.length !== 16) {
    return errorResponse(400, "R16 must be an array of exactly 16 teams");
  }
  if (!QF || !Array.isArray(QF) || QF.length !== 8) {
    return errorResponse(400, "QF must be an array of exactly 8 teams");
  }
  if (!SF || !Array.isArray(SF) || SF.length !== 4) {
    return errorResponse(400, "SF must be an array of exactly 4 teams");
  }
  if (!Final || !Array.isArray(Final) || Final.length !== 2) {
    return errorResponse(400, "Final must be an array of exactly 2 teams");
  }
  if (!Champion || typeof Champion !== "string") {
    return errorResponse(400, "Champion must be a single team code string");
  }

  // Validate Champion is in Final
  if (!Final.includes(Champion)) {
    return errorResponse(400, "Champion must be one of the two Final teams");
  }

  // Validate all teams are unique within each round
  for (const [roundName, roundTeams] of [
    ["R16", R16],
    ["QF", QF],
    ["SF", SF],
    ["Final", Final],
  ] as [string, string[]][]) {
    const unique = new Set(roundTeams);
    if (unique.size !== roundTeams.length) {
      return errorResponse(400, `${roundName} teams must all be distinct`);
    }
  }

  // Validate progression: each subsequent round's teams must be subset of previous
  const r16Set = new Set(R16);
  for (const team of QF) {
    if (!r16Set.has(team)) {
      return errorResponse(400, `QF team ${team} must be in R16 picks`);
    }
  }
  const qfSet = new Set(QF);
  for (const team of SF) {
    if (!qfSet.has(team)) {
      return errorResponse(400, `SF team ${team} must be in QF picks`);
    }
  }
  const sfSet = new Set(SF);
  for (const team of Final) {
    if (!sfSet.has(team)) {
      return errorResponse(400, `Final team ${team} must be in SF picks`);
    }
  }

  const now = new Date().toISOString();
  const knockoutItem: KnockoutPicksItem = {
    PK: `USER#${userId}`,
    SK: "PICK#KNOCKOUT",
    R16,
    QF,
    SF,
    Final,
    Champion,
    locked: false,
    submitted_at: now,
  };

  await putItem(knockoutItem as unknown as Record<string, unknown>);

  return response(200, {
    R16,
    QF,
    SF,
    Final,
    Champion,
    locked: false,
    submitted_at: now,
  });
}
