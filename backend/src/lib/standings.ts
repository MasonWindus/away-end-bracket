import { GroupCode, GroupResult, MatchResult } from "../types";
import { GROUPS } from "../data/teams";

interface TeamStats {
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

export function computeGroupStandings(group: GroupCode, matches: MatchResult[]): GroupResult | null {
  if (matches.length === 0) return null;

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

  const sorted = Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.localeCompare(b.team);
  });

  return {
    group_code: group,
    first_place: sorted[0].team,
    second_place: sorted[1].team,
    third_place: sorted[2].team,
    fourth_place: sorted[3].team,
    entered_at: new Date().toISOString(),
  };
}
