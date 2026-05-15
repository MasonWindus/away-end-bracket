export type GroupCode = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";
export type KnockoutRound = "R16" | "QF" | "SF" | "Final" | "Champion";

export interface User {
  id: string;
  display_name: string;
  email: string;
  is_admin: boolean;
}

export interface GroupPick {
  group_code: GroupCode;
  first_place: string;
  second_place: string;
  third_place: string;
  fourth_place: string;
  locked: boolean;
}

export interface ThirdsPick {
  teams: string[];
  locked: boolean;
}

export interface KnockoutPicks {
  R16: string[];      // 16 teams advancing from R32
  QF: string[];       // 8 teams advancing from R16
  SF: string[];       // 4 teams advancing from QF
  Final: string[];    // 2 teams advancing from SF
  Champion: string;   // 1 champion
  locked: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  display_name: string;
  group_stage_score: number;
  knockout_score: number;
  total_score: number;
}

export interface GroupResult {
  group_code: GroupCode;
  first_place: string;
  second_place: string;
  third_place: string;
  fourth_place: string;
}

export interface ThirdsResult {
  qualified_thirds: string[];            // 8 teams that qualified as best thirds
  bracket_slots: Record<string, string>; // slot index -> team code
}

export interface KnockoutResult {
  R32Winners: string[];  // 16 teams
  R16Winners: string[];  // 8 teams
  QFWinners: string[];   // 4 teams
  SFWinners: string[];   // 2 teams (the finalists)
  champion: string;
}

export interface AdminUser {
  id: string;
  display_name: string;
  email: string;
  has_group_picks: boolean;
  has_thirds_picks: boolean;
  has_knockout_picks: boolean;
  total_score: number;
}

export interface PublicBracket {
  userId: string;
  display_name: string;
  group_picks: GroupPick[];
  thirds_pick: ThirdsPick | null;
  knockout_picks: KnockoutPicks | null;
}

export interface MatchResult {
  match_id: string;
  group_code: GroupCode;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  entered_at: string;
}
