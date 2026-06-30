import { GroupCode, GroupPick, GroupResult, KnockoutPicks, KnockoutResult, ScoreBreakdown, ThirdsResult } from "../types";

/**
 * Calculate score for a single group pick vs actual group result.
 * 1 point per team in correct position (max 4).
 */
export function calculateGroupScore(pick: GroupPick, result: GroupResult): number {
  let score = 0;
  if (pick.first_place === result.first_place) score += 1;
  if (pick.second_place === result.second_place) score += 1;
  if (pick.third_place === result.third_place) score += 1;
  if (pick.fourth_place === result.fourth_place) score += 1;
  return score;
}

/**
 * Calculate score for thirds picks.
 * 1 point per correctly picked third-place advancer.
 */
export function calculateThirdsScore(picks: string[], actual: string[]): number {
  const actualSet = new Set(actual);
  return picks.filter((team) => actualSet.has(team)).length;
}

interface KnockoutScoreResult {
  r32Score: number;
  r16Score: number;
  qfScore: number;
  sfScore: number;
  finalistScore: number;
  championScore: number;
  total: number;
}

/**
 * Calculate all knockout round scores.
 *
 * Each round's "advancing teams" score credits the user for correctly predicting
 * which teams WIN that round. A team winning round X is the same event as it
 * becoming an entrant of round X+1, so the comparison is always the user's picks
 * for round X+1 against the actual round X winners (e.g. R32 winners are the R16
 * entrants, so R32 score = knockoutPicks.R16 ∩ knockoutResult.R32Winners).
 *
 * R32 score: intersection of user's R16 picks (16 teams) with actual R32 winners × 2
 * R16 score: intersection of user's QF picks (8 teams) with actual R16 winners × 4
 * QF score: intersection of user's SF picks (4) with actual QF winners × 6
 * SF score: intersection of user's Final picks (2) with actual SF winners × 10
 * Finalist: actual non-champion finalist in user's Final array → 15
 * Champion: user's Champion === actual champion → 20
 */
export function calculateKnockoutScore(
  knockoutPicks: KnockoutPicks,
  knockoutResult: KnockoutResult
): KnockoutScoreResult {
  // R32 score: did the user's predicted R16 entrants match the actual R32 winners?
  const r16PicksSet = new Set(knockoutPicks.R16 || []);
  const r32Winners = knockoutResult.R32Winners || [];
  const r32Score = r32Winners.filter((team) => r16PicksSet.has(team)).length * 2;

  // R16 score: did the user's predicted QF entrants match the actual R16 winners?
  const qfPicksSet = new Set(knockoutPicks.QF || []);
  const r16Winners = knockoutResult.R16Winners || [];
  const r16Score = r16Winners.filter((team) => qfPicksSet.has(team)).length * 4;

  // QF score: did the user's predicted SF entrants match the actual QF winners?
  const sfPicksSet = new Set(knockoutPicks.SF || []);
  const qfWinners = knockoutResult.QFWinners || [];
  const qfScore = qfWinners.filter((team) => sfPicksSet.has(team)).length * 6;

  // SF score: did the user's predicted Final entrants match the actual SF winners?
  const finalPicksSet = new Set(knockoutPicks.Final || []);
  const sfWinners = knockoutResult.SFWinners || [];
  const sfScore = sfWinners.filter((team) => finalPicksSet.has(team)).length * 10;

  // Finalist score: 15 pts if the non-champion finalist is in user's Final picks
  const actualChampion = knockoutResult.champion;
  const sfWinnersSet = new Set(sfWinners);
  // The two finalists are the two SF winners; the non-champion is the one that isn't the champion
  const finalists = sfWinners.filter((team) => team !== actualChampion);
  const userFinalSet = new Set(knockoutPicks.Final || []);
  const finalistScore = finalists.some((team) => userFinalSet.has(team)) ? 15 : 0;

  // Champion score
  const championScore = knockoutPicks.Champion === actualChampion ? 20 : 0;

  // Silence unused variable warning
  void sfWinnersSet;

  const total = r32Score + r16Score + qfScore + sfScore + finalistScore + championScore;

  return { r32Score, r16Score, qfScore, sfScore, finalistScore, championScore, total };
}

/**
 * Calculate all scores for a user and return a ScoreBreakdown.
 */
export function calculateAllScores(
  allGroupPicks: Record<GroupCode, GroupPick>,
  thirdsPicks: string[],
  knockoutPicks: KnockoutPicks | null,
  allGroupResults: Record<GroupCode, GroupResult>,
  thirdsResult: ThirdsResult | null,
  knockoutResult: KnockoutResult | null
): ScoreBreakdown {
  const groups = {} as Record<GroupCode, number>;
  let groupStageTotal = 0;

  // Calculate group scores
  const groupCodes: GroupCode[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  for (const code of groupCodes) {
    const pick = allGroupPicks[code];
    const result = allGroupResults[code];
    if (pick && result) {
      const score = calculateGroupScore(pick, result);
      groups[code] = score;
      groupStageTotal += score;
    } else {
      groups[code] = 0;
    }
  }

  // Calculate thirds score
  let thirdsScore = 0;
  if (thirdsResult && thirdsPicks.length > 0) {
    thirdsScore = calculateThirdsScore(thirdsPicks, thirdsResult.qualified_thirds);
    groupStageTotal += thirdsScore;
  }

  // Calculate knockout scores
  let r32Score = 0;
  let r16Score = 0;
  let qfScore = 0;
  let sfScore = 0;
  let finalistScore = 0;
  let championScore = 0;
  let knockoutTotal = 0;

  if (knockoutPicks && knockoutResult) {
    const knockoutResult_ = calculateKnockoutScore(knockoutPicks, knockoutResult);
    r32Score = knockoutResult_.r32Score;
    r16Score = knockoutResult_.r16Score;
    qfScore = knockoutResult_.qfScore;
    sfScore = knockoutResult_.sfScore;
    finalistScore = knockoutResult_.finalistScore;
    championScore = knockoutResult_.championScore;
    knockoutTotal = knockoutResult_.total;
  }

  const total = groupStageTotal + knockoutTotal;

  return {
    groups,
    thirds: thirdsScore,
    r32: r32Score,
    r16: r16Score,
    qf: qfScore,
    sf: sfScore,
    finalist: finalistScore,
    champion: championScore,
    group_stage_total: groupStageTotal,
    knockout_total: knockoutTotal,
    total,
  };
}
