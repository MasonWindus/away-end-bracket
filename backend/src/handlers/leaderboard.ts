import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { batchGetItems, getItem, queryItems, scanItems } from "../lib/db";
import { AuthError, errorResponse, response } from "../lib/middleware";
import { computeLiveGroupTable } from "../lib/standings";
import {
  GroupCode,
  GroupPickItem,
  KnockoutPicksItem,
  LeaderboardEntry,
  MatchResult,
  MatchResultItem,
  ScoresItem,
  ThirdsPickItem,
  UserItem,
} from "../types";

const GROUP_CODES: GroupCode[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
];

export async function handleLeaderboard(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  try {
    if (method === "GET" && path === "/api/leaderboard") {
      return await getLeaderboard(event);
    }

    if (method === "GET" && path === "/api/standings") {
      return await getStandings();
    }

    const bracketMatch = path.match(/^\/api\/brackets\/([^/]+)$/);
    if (method === "GET" && bracketMatch) {
      const userId = bracketMatch[1];
      return await getUserBracket(userId);
    }

    return errorResponse(404, "Not found");
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.statusCode, err.message);
    }
    console.error("Leaderboard error:", err);
    return errorResponse(500, "Internal server error");
  }
}

const LEADERBOARD_PAGE_SIZE = 50;

function makeDiscriminator(userId: string): string {
  let h = 5381;
  for (let i = 0; i < userId.length; i++) {
    h = ((h << 5) + h + userId.charCodeAt(i)) & 0xffff;
  }
  return h.toString(16).toUpperCase().padStart(4, "0");
}

function assignRanks<T extends { total_score: number }>(
  sortedEntries: T[]
): (T & { rank: number })[] {
  const ranked: (T & { rank: number })[] = [];
  let rank = 1;
  for (let i = 0; i < sortedEntries.length; i++) {
    if (i > 0 && sortedEntries[i].total_score < sortedEntries[i - 1].total_score) {
      rank = i + 1;
    }
    ranked.push({ rank, ...sortedEntries[i] });
  }
  return ranked;
}

async function getLeaderboard(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const qs = event.queryStringParameters ?? {};
  const page = Math.max(1, parseInt(qs.page ?? "1", 10) || 1);
  const search = (qs.search ?? "").trim().toLowerCase();
  const currentUserId = (qs.userId ?? "").trim();
  const excludeLate = (qs.excludeLate ?? "").trim().toLowerCase() === "true";

  // Query all users via GSI1 (paginated internally)
  const userItems = await queryItems({
    IndexName: "GSI1",
    KeyConditionExpression: "GSI1PK = :pk",
    ExpressionAttributeValues: {
      ":pk": "USERS",
    },
  }) as unknown as UserItem[];

  // Batch-fetch all scores in parallel (100 keys per request instead of N individual calls)
  const scoreKeys = userItems.map((u) => ({ PK: `USER#${u.id}`, SK: "SCORES" }));
  const scoreItems = await batchGetItems(scoreKeys) as unknown as ScoresItem[];
  const scoreMap = new Map<string, ScoresItem>();
  for (const s of scoreItems) {
    scoreMap.set(s.PK, s);
  }

  // Build full sorted+ranked list
  const combined = userItems.map((user) => {
    const s = scoreMap.get(`USER#${user.id}`);
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

  // Counts always reflect the full population, regardless of the filter applied below.
  const totalEntrants = combined.length;
  const lateEntryCount = combined.filter((e) => e.is_late_entry).length;

  // When excluding late entries, drop them before ranking so standings are
  // recalculated from scratch for the filtered field (no gaps left behind).
  const rankingSource = excludeLate ? combined.filter((e) => !e.is_late_entry) : combined;
  const ranked = assignRanks(rankingSource);

  // Attach a deterministic 4-char discriminator to non-pinned entries whose
  // display_name collides with at least one other user (case-insensitive).
  const nameCounts = new Map<string, number>();
  for (const e of ranked) {
    const key = e.display_name.toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  const withDiscriminators = ranked.map((e) => ({
    ...e,
    discriminator:
      !e.is_pinned && (nameCounts.get(e.display_name.toLowerCase()) ?? 0) > 1
        ? makeDiscriminator(e.userId)
        : undefined,
  }));

  // Pinned entries always returned in full (for the hosts spotlight)
  const pinned = withDiscriminators.filter((e) => e.is_pinned);

  // Current user's entry always returned regardless of page/search
  const currentUserEntry = currentUserId
    ? (withDiscriminators.find((e) => e.userId === currentUserId) ?? null)
    : null;

  // Apply search filter then paginate
  const searchFiltered = search
    ? withDiscriminators.filter((e) => e.display_name.toLowerCase().includes(search))
    : withDiscriminators;

  const total = searchFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / LEADERBOARD_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const entries: LeaderboardEntry[] = searchFiltered.slice(
    (safePage - 1) * LEADERBOARD_PAGE_SIZE,
    safePage * LEADERBOARD_PAGE_SIZE
  );

  return response(200, { entries, pinned, total, totalEntrants, lateEntryCount, page: safePage, totalPages, currentUserEntry });
}

async function getStandings(): Promise<APIGatewayProxyResult> {
  const items = (await scanItems({
    FilterExpression: "begins_with(PK, :prefix)",
    ExpressionAttributeValues: { ":prefix": "MATCH#GROUP#" },
  })) as unknown as MatchResultItem[];

  const matchesByGroup = items.reduce<Record<GroupCode, MatchResult[]>>((acc, item) => {
    const code = item.group_code;
    if (!acc[code]) acc[code] = [];
    acc[code].push({
      match_id: item.match_id,
      group_code: item.group_code,
      home_team: item.home_team,
      away_team: item.away_team,
      home_goals: item.home_goals,
      away_goals: item.away_goals,
      entered_at: item.entered_at,
    });
    return acc;
  }, {} as Record<GroupCode, MatchResult[]>);

  const groups = GROUP_CODES.map((code) => {
    const matches = (matchesByGroup[code] ?? []).sort((a, b) => a.entered_at.localeCompare(b.entered_at));
    return {
      group_code: code,
      table: computeLiveGroupTable(code, matches),
      matches,
    };
  });

  return response(200, { groups });
}

async function getUserBracket(userId: string): Promise<APIGatewayProxyResult> {
  // Verify user exists
  const userItem = await getItem({
    PK: `USER#${userId}`,
    SK: `USER#${userId}`,
  }) as UserItem | undefined;

  if (!userItem) {
    return errorResponse(404, "User not found");
  }

  // Fetch all group picks
  const groupPickItems = await queryItems({
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
    ExpressionAttributeValues: {
      ":pk": `USER#${userId}`,
      ":skPrefix": "PICK#GROUP#",
    },
  }) as unknown as GroupPickItem[];

  const groupPicks = GROUP_CODES.map((code) => {
    const found = groupPickItems.find(
      (item) => item.SK === `PICK#GROUP#${code}`
    );

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

  // Fetch thirds pick
  const thirdsPick = await getItem({
    PK: `USER#${userId}`,
    SK: "PICK#THIRDS",
  }) as ThirdsPickItem | undefined;

  // Fetch knockout picks
  const knockoutPick = await getItem({
    PK: `USER#${userId}`,
    SK: "PICK#KNOCKOUT",
  }) as KnockoutPicksItem | undefined;

  // Fetch scores
  const scoresItem = await getItem({
    PK: `USER#${userId}`,
    SK: "SCORES",
  }) as ScoresItem | undefined;

  return response(200, {
    userId: userItem.id,
    display_name: userItem.display_name,
    is_late_entry: userItem.is_late_entry ?? false,
    group_picks: groupPicks,
    thirds_pick: thirdsPick
      ? {
          teams: thirdsPick.teams,
          locked: thirdsPick.locked,
          submitted_at: thirdsPick.submitted_at,
        }
      : { teams: [], locked: false, submitted_at: null },
    knockout_picks: knockoutPick
      ? {
          R16: knockoutPick.R16,
          QF: knockoutPick.QF,
          SF: knockoutPick.SF,
          Final: knockoutPick.Final,
          Champion: knockoutPick.Champion,
          locked: knockoutPick.locked,
          submitted_at: knockoutPick.submitted_at,
        }
      : {
          R16: [],
          QF: [],
          SF: [],
          Final: [],
          Champion: null,
          locked: false,
          submitted_at: null,
        },
    scores: scoresItem
      ? {
          group_stage_score: scoresItem.group_stage_score,
          knockout_score: scoresItem.knockout_score,
          total_score: scoresItem.total_score,
          breakdown: scoresItem.breakdown,
          last_calculated: scoresItem.last_calculated,
        }
      : null,
  });
}
