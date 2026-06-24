import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { batchGetItems, batchWriteItems, deleteItem, getItem, putItem, queryItems, scanItems, updateItem } from "../lib/db";
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
  PICKS_DEADLINE,
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

    // GET /api/admin/recalculate/status
    if (method === "GET" && path === "/api/admin/recalculate/status") {
      const status = await getItem({ PK: "RECALC#STATUS", SK: "STATUS" });
      return response(200, status ?? { status: "never_run" });
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

    // POST /api/admin/users/:userId/late-entry
    const lateEntryMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/late-entry$/);
    if (method === "POST" && lateEntryMatch) {
      return await markLateEntry(lateEntryMatch[1]);
    }

    // DELETE /api/admin/users/:userId/late-entry
    if (method === "DELETE" && lateEntryMatch) {
      return await unmarkLateEntry(lateEntryMatch[1]);
    }

    // POST /api/admin/backfill-late-entries
    if (method === "POST" && path === "/api/admin/backfill-late-entries") {
      return await backfillLateEntries();
    }

    // GET /api/admin/bug-reports
    if (method === "GET" && path === "/api/admin/bug-reports") {
      return await getBugReports();
    }

    // POST /api/admin/bug-reports/backfill-display-names
    if (method === "POST" && path === "/api/admin/bug-reports/backfill-display-names") {
      return await backfillBugReportDisplayNames();
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
  await putItem({
    PK: "RECALC#STATUS",
    SK: "STATUS",
    status: "running",
    started_at: new Date().toISOString(),
    processed: 0,
  });

  const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || "us-east-1" });
  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: process.env.FUNCTION_NAME || "away-end-bracket-api",
      InvocationType: "Event",
      Payload: JSON.stringify({ backgroundTask: "recalculate" }),
    })
  );

  return response(202, { message: "Recalculation started" });
}

export async function recalculateScoresBackground(): Promise<void> {
  try {
    // Fetch all results + match data for provisional standings
    const [allGroupResultsArr, thirdsResultRaw, knockoutResultRaw, allMatchItems] = await Promise.all([
      Promise.all(
        GROUP_CODES.map((code) => getItem({ PK: `RESULT#GROUP#${code}`, SK: "RESULT" }))
      ),
      getItem({ PK: "RESULT#THIRDS", SK: "RESULT" }),
      getItem({ PK: "RESULT#KNOCKOUT", SK: "RESULT" }),
      scanItems({
        FilterExpression: "begins_with(PK, :prefix)",
        ExpressionAttributeValues: { ":prefix": "MATCH#GROUP#" },
      }),
    ]);

    // Build provisional standings map, but only for groups where every team has played
    const matchesByGroup = (allMatchItems as unknown as MatchResultItem[]).reduce<Record<GroupCode, MatchResultItem[]>>(
      (acc, item) => {
        const code = item.group_code;
        if (!acc[code]) acc[code] = [];
        acc[code].push(item);
        return acc;
      },
      {} as Record<GroupCode, MatchResultItem[]>
    );

    const allGroupResults = GROUP_CODES.reduce<Record<GroupCode, GroupResult>>(
      (acc, code, idx) => {
        const raw = allGroupResultsArr[idx];
        if (raw) {
          acc[code] = raw as unknown as GroupResult;
        } else {
          const provisional = computeGroupStandings(code, matchesByGroup[code] ?? [] as unknown as import("../types").MatchResult[]);
          if (provisional) acc[code] = provisional;
        }
        return acc;
      },
      {} as Record<GroupCode, GroupResult>
    );

    const thirdsResult = thirdsResultRaw as unknown as ThirdsResult | null;
    const knockoutResult = knockoutResultRaw as unknown as KnockoutResult | null;

    // Scan all users then batch-get all picks using known key patterns
    const userItems = (await scanItems({
      FilterExpression: "begins_with(PK, :prefix) AND SK = PK",
      ExpressionAttributeValues: { ":prefix": "USER#" },
    })) as unknown as UserItem[];

    const pickSKs = [
      ...GROUP_CODES.map((code) => `PICK#GROUP#${code}`),
      "PICK#THIRDS",
      "PICK#KNOCKOUT",
    ];
    const allPickKeys = (userItems as unknown as UserItem[]).flatMap((u) =>
      pickSKs.map((sk) => ({ PK: `USER#${u.id}`, SK: sk }))
    );

    const BATCH_SIZE = 100;
    const FETCH_CONCURRENCY = 10;
    const allPickItems: Record<string, unknown>[] = [];
    const keyBatches: Record<string, unknown>[][] = [];
    for (let i = 0; i < allPickKeys.length; i += BATCH_SIZE) {
      keyBatches.push(allPickKeys.slice(i, i + BATCH_SIZE));
    }
    for (let i = 0; i < keyBatches.length; i += FETCH_CONCURRENCY) {
      const results = await Promise.all(
        keyBatches.slice(i, i + FETCH_CONCURRENCY).map((keys) => batchGetItems(keys))
      );
      for (const batch of results) allPickItems.push(...batch);
    }

    const picksByUser = new Map<string, Record<string, unknown>[]>();
    for (const item of allPickItems) {
      const pk = item.PK as string;
      const userId = pk.replace("USER#", "");
      if (!picksByUser.has(userId)) picksByUser.set(userId, []);
      picksByUser.get(userId)!.push(item);
    }

    const now = new Date().toISOString();
    const scoresItems: Record<string, unknown>[] = [];
    const userScores: { userId: string; total: number }[] = [];

    for (const user of userItems as unknown as UserItem[]) {
      try {
        const userId = user.id;
        const picks = picksByUser.get(userId) ?? [];

        const groupPickItems = picks.filter((p) =>
          (p.SK as string).startsWith("PICK#GROUP#")
        ) as unknown as GroupPickItem[];
        const thirdsPickRaw = picks.find((p) => p.SK === "PICK#THIRDS") as unknown as ThirdsPickItem | undefined;
        const knockoutPickRaw = picks.find((p) => p.SK === "PICK#KNOCKOUT") as unknown as KnockoutPicks | undefined;

        const allGroupPicks = GROUP_CODES.reduce<Record<GroupCode, GroupPick>>(
          (acc, code) => {
            const found = groupPickItems.find((item) => item.SK === `PICK#GROUP#${code}`);
            if (found) acc[code] = found as unknown as GroupPick;
            return acc;
          },
          {} as Record<GroupCode, GroupPick>
        );

        const breakdown: ScoreBreakdown = calculateAllScores(
          allGroupPicks,
          picks.find((p) => p.SK === "PICK#THIRDS") ? (thirdsPickRaw as unknown as ThirdsPickItem)?.teams ?? [] : [],
          knockoutPickRaw ?? null,
          allGroupResults,
          thirdsResult,
          knockoutResult
        );

        const scoresItem: ScoresItem = {
          PK: `USER#${userId}`,
          SK: "SCORES",
          group_stage_score: breakdown.group_stage_total,
          knockout_score: breakdown.knockout_total,
          total_score: breakdown.total,
          breakdown,
          last_calculated: now,
        };
        scoresItems.push(scoresItem as unknown as Record<string, unknown>);
        userScores.push({ userId, total: breakdown.total });
      } catch (userErr) {
        console.error(`Error processing user ${user.id}:`, userErr);
      }
    }

    const WRITE_CONCURRENCY = 10;
    const writeBatches: Record<string, unknown>[][] = [];
    for (let i = 0; i < scoresItems.length; i += 25) {
      writeBatches.push(scoresItems.slice(i, i + 25));
    }
    for (let i = 0; i < writeBatches.length; i += WRITE_CONCURRENCY) {
      await Promise.all(
        writeBatches.slice(i, i + WRITE_CONCURRENCY).map((batch) => batchWriteItems(batch))
      );
    }

    const UPDATE_CONCURRENCY = 100;
    for (let i = 0; i < userScores.length; i += UPDATE_CONCURRENCY) {
      await Promise.all(
        userScores.slice(i, i + UPDATE_CONCURRENCY).map(({ userId, total }) =>
          updateItem({
            Key: { PK: `USER#${userId}`, SK: `USER#${userId}` },
            UpdateExpression: "SET GSI1SK = :score",
            ExpressionAttributeValues: { ":score": total },
          })
        )
      );
    }

    // ── Build leaderboard cache ────────────────────────────────────────────
    // Fetch all users once more (we have scores now) and write a single cache
    // item so GET /api/leaderboard only costs 1 read instead of 1,400+.
    const allUsersFinal = (await scanItems({
      FilterExpression: "begins_with(PK, :prefix) AND SK = PK",
      ExpressionAttributeValues: { ":prefix": "USER#" },
    })) as unknown as UserItem[];

    const scoreMapFinal = new Map<string, ScoresItem>();
    for (const s of scoresItems as unknown as ScoresItem[]) {
      scoreMapFinal.set(s.PK, s);
    }

    const combined = allUsersFinal.map((user) => {
      const s = scoreMapFinal.get(`USER#${user.id}`);
      return {
        userId: user.id,
        display_name: user.display_name,
        group_stage_score: s?.group_stage_score ?? 0,
        knockout_score: s?.knockout_score ?? 0,
        total_score: s?.total_score ?? 0,
        is_pinned: user.is_pinned ?? false,
        is_late_entry: user.is_late_entry ?? false,
      };
    });

    combined.sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      return a.display_name.localeCompare(b.display_name);
    });

    const totalEntrants = combined.length;
    const lateEntryCount = combined.filter((e) => e.is_late_entry).length;

    // Rank + attach discriminators
    let rank = 1;
    const nameCounts = new Map<string, number>();
    for (const e of combined) {
      const key = e.display_name.toLowerCase();
      nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }
    const rankedEntries = combined.map((e, i) => {
      if (i > 0 && combined[i].total_score < combined[i - 1].total_score) rank = i + 1;
      const discriminator =
        !e.is_pinned && (nameCounts.get(e.display_name.toLowerCase()) ?? 0) > 1
          ? (() => {
              let h = 5381;
              for (let c = 0; c < e.userId.length; c++) {
                h = ((h << 5) + h + e.userId.charCodeAt(c)) & 0xffff;
              }
              return h.toString(16).toUpperCase().padStart(4, "0");
            })()
          : undefined;
      return { rank, ...e, discriminator };
    });

    // Write cache in chunks of 400 entries to stay under DynamoDB's 400KB item limit.
    // Readers reassemble via batchGetItems on SK CACHE#0, CACHE#1, etc.
    const CACHE_CHUNK_SIZE = 400;
    const cacheChunks: Record<string, unknown>[] = [];
    for (let i = 0; i < rankedEntries.length; i += CACHE_CHUNK_SIZE) {
      cacheChunks.push({
        PK: "LEADERBOARD#CACHE",
        SK: `CACHE#${Math.floor(i / CACHE_CHUNK_SIZE)}`,
        entries: rankedEntries.slice(i, i + CACHE_CHUNK_SIZE),
        totalEntrants,
        lateEntryCount,
        chunkCount: Math.ceil(rankedEntries.length / CACHE_CHUNK_SIZE),
        cached_at: now,
      });
    }
    await batchWriteItems(cacheChunks);
    // ── End leaderboard cache ──────────────────────────────────────────────

    await putItem({
      processed: scoresItems.length,
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    await putItem({
      PK: "RECALC#STATUS",
      SK: "STATUS",
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      completed_at: new Date().toISOString(),
    });
    throw err;
  }
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

  // Invalidate the standings cache. getStandings() will recompute from scratch
  // on the next request and re-warm the cache automatically.
  await deleteItem({ PK: "STANDINGS#CACHE", SK: "CACHE" });

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

  await deleteItem({ PK: "STANDINGS#CACHE", SK: "CACHE" });

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

async function backfillLateEntries(): Promise<APIGatewayProxyResult> {
  const allUsers = await scanItems({
    FilterExpression: "begins_with(PK, :prefix) AND SK = PK",
    ExpressionAttributeValues: { ":prefix": "USER#" },
  }) as unknown as UserItem[];

  const deadline = new Date(PICKS_DEADLINE);
  const toUpdate = allUsers.filter(
    (u) => u.created_at && new Date(u.created_at) > deadline && !u.is_late_entry
  );

  for (const user of toUpdate) {
    await updateItem({
      Key: { PK: user.PK, SK: user.SK },
      UpdateExpression: "SET is_late_entry = :val",
      ExpressionAttributeValues: { ":val": true },
    });
  }

  return response(200, { updated: toUpdate.length, userIds: toUpdate.map((u) => u.id) });
}

async function markLateEntry(userId: string): Promise<APIGatewayProxyResult> {
  const userItem = await getItem({ PK: `USER#${userId}`, SK: `USER#${userId}` }) as UserItem | undefined;
  if (!userItem) return errorResponse(404, "User not found");

  await updateItem({
    Key: { PK: `USER#${userId}`, SK: `USER#${userId}` },
    UpdateExpression: "SET is_late_entry = :val",
    ExpressionAttributeValues: { ":val": true },
  });

  return response(200, { message: "User marked as late entry" });
}

async function unmarkLateEntry(userId: string): Promise<APIGatewayProxyResult> {
  const userItem = await getItem({ PK: `USER#${userId}`, SK: `USER#${userId}` }) as UserItem | undefined;
  if (!userItem) return errorResponse(404, "User not found");

  await updateItem({
    Key: { PK: `USER#${userId}`, SK: `USER#${userId}` },
    UpdateExpression: "REMOVE is_late_entry",
  });

  return response(200, { message: "Late entry flag removed" });
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

async function backfillBugReportDisplayNames(): Promise<APIGatewayProxyResult> {
  const items = await queryItems({
    IndexName: "GSI1",
    KeyConditionExpression: "GSI1PK = :pk",
    ExpressionAttributeValues: { ":pk": "BUG_REPORTS" },
  }) as unknown as BugReportItem[];

  const toUpdate = items.filter((item) => item.user_id && !item.display_name);

  let updated = 0;
  for (const item of toUpdate) {
    const userItem = await getItem({
      PK: `USER#${item.user_id}`,
      SK: `USER#${item.user_id}`,
    }) as UserItem | undefined;
    if (!userItem?.display_name) continue;

    await updateItem({
      Key: { PK: item.PK, SK: item.SK },
      UpdateExpression: "SET display_name = :name",
      ExpressionAttributeValues: { ":name": userItem.display_name },
    });
    updated++;
  }

  return response(200, { updated, checked: toUpdate.length });
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
  const search = (qs.search ?? "").trim().toLowerCase();

  let allUserItems = await scanItems({
    FilterExpression: "begins_with(PK, :prefix) AND SK = PK",
    ExpressionAttributeValues: {
      ":prefix": "USER#",
    },
  }) as unknown as UserItem[];

  if (search) {
    allUserItems = allUserItems.filter(
      (u) =>
        (u.display_name ?? "").toLowerCase().includes(search) ||
        (u.email ?? "").toLowerCase().includes(search)
    );
  }

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
        is_late_entry: user.is_late_entry ?? false,
        created_at: user.created_at ?? null,
        has_group_picks: groupsComplete,
        has_thirds_picks: thirdsComplete,
        has_knockout_picks: knockoutComplete,
        total_score: scoresItem?.total_score ?? 0,
      };
    })
  );

  return response(200, { users: usersWithStatus, total, page, limit });
}
