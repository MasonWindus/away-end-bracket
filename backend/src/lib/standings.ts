import { GroupCode, GroupResult, MatchResult } from "../types";
import { GROUPS } from "../data/teams";

export interface TeamStats {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

function buildGroupStats(group: GroupCode, matches: MatchResult[]): TeamStats[] {
  const groupTeams = GROUPS[group].map((t) => t.code);
  const stats: Record<string, TeamStats> = {};
  for (const team of groupTeams) {
    stats[team] = { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
  }

  for (const match of matches) {
    const home = stats[match.home_team];
    const away = stats[match.away_team];
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.gf += match.home_goals;
    home.ga += match.away_goals;
    away.gf += match.away_goals;
    away.ga += match.home_goals;
    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;

    if (match.home_goals > match.away_goals) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (match.home_goals < match.away_goals) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      home.points += 1;
      away.drawn++;
      away.points += 1;
    }
  }

  return sortStandings(Object.values(stats), matches);
}

/**
 * FIFA tie-break order for teams level on points: head-to-head points, then
 * head-to-head goal difference, then head-to-head goals scored (among the
 * tied teams' matches against each other), then overall goal difference,
 * then overall goals scored. Team conduct / world ranking criteria aren't
 * tracked here, so ties that survive all of the above fall back to name order.
 */
function sortStandings(teams: TeamStats[], matches: MatchResult[]): TeamStats[] {
  const groups: TeamStats[][] = [];
  for (const team of [...teams].sort((a, b) => b.points - a.points)) {
    const last = groups[groups.length - 1];
    if (last && last[0].points === team.points) {
      last.push(team);
    } else {
      groups.push([team]);
    }
  }

  const result: TeamStats[] = [];
  for (const tied of groups) {
    result.push(...breakTies(tied, matches));
  }
  return result;
}

function breakTies(tied: TeamStats[], matches: MatchResult[]): TeamStats[] {
  if (tied.length === 1) return tied;

  const teamCodes = new Set(tied.map((t) => t.team));
  const headToHead = matches.filter(
    (m) => teamCodes.has(m.home_team) && teamCodes.has(m.away_team)
  );
  const h2h = buildHeadToHeadStats(tied, headToHead);

  return [...tied].sort((a, b) => {
    const ah = h2h[a.team];
    const bh = h2h[b.team];
    if (bh.points !== ah.points) return bh.points - ah.points;
    if (bh.gd !== ah.gd) return bh.gd - ah.gd;
    if (bh.gf !== ah.gf) return bh.gf - ah.gf;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.localeCompare(b.team);
  });
}

function buildHeadToHeadStats(
  tied: TeamStats[],
  headToHead: MatchResult[]
): Record<string, { points: number; gf: number; ga: number; gd: number }> {
  const stats: Record<string, { points: number; gf: number; ga: number; gd: number }> = {};
  for (const team of tied) {
    stats[team.team] = { points: 0, gf: 0, ga: 0, gd: 0 };
  }

  for (const match of headToHead) {
    const home = stats[match.home_team];
    const away = stats[match.away_team];
    if (!home || !away) continue;

    home.gf += match.home_goals;
    home.ga += match.away_goals;
    away.gf += match.away_goals;
    away.ga += match.home_goals;
    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;

    if (match.home_goals > match.away_goals) {
      home.points += 3;
    } else if (match.home_goals < match.away_goals) {
      away.points += 3;
    } else {
      home.points += 1;
      away.points += 1;
    }
  }

  return stats;
}

/** Live table for a group, including teams that haven't played yet. */
export function computeLiveGroupTable(group: GroupCode, matches: MatchResult[]): TeamStats[] {
  return buildGroupStats(group, matches);
}

export function computeGroupStandings(group: GroupCode, matches: MatchResult[]): GroupResult | null {
  if (matches.length === 0) return null;

  const sorted = buildGroupStats(group, matches);

  // If any team hasn't played yet, standings are indeterminate — skip provisional scoring
  if (sorted.some((s) => s.played === 0)) return null;

  return {
    group_code: group,
    first_place: sorted[0].team,
    second_place: sorted[1].team,
    third_place: sorted[2].team,
    fourth_place: sorted[3].team,
    entered_at: new Date().toISOString(),
  };
}
