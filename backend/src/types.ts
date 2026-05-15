export type GroupCode = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";

export type Round = "R16" | "QF" | "SF" | "Final" | "Champion";

export const PICKS_DEADLINE = "2026-06-11T16:00:00Z";

export interface User {
  id: string;
  display_name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  total_score?: number;
}

export interface GroupPick {
  user_id: string;
  group_code: GroupCode;
  first_place: string;
  second_place: string;
  third_place: string;
  fourth_place: string;
  locked: boolean;
  submitted_at: string;
}

export interface ThirdsPicks {
  user_id: string;
  teams: string[];
  locked: boolean;
  submitted_at: string;
}

export interface KnockoutPicks {
  user_id: string;
  R16: string[];
  QF: string[];
  SF: string[];
  Final: string[];
  Champion: string;
  locked: boolean;
  submitted_at: string;
}

export interface GroupResult {
  group_code: GroupCode;
  first_place: string;
  second_place: string;
  third_place: string;
  fourth_place: string;
  entered_at: string;
}

export interface ThirdsResult {
  qualified_thirds: string[];
  bracket_slots: Record<string, string>;
  entered_at: string;
}

export interface KnockoutResult {
  R32Winners: string[];
  R16Winners: string[];
  QFWinners: string[];
  SFWinners: string[];
  champion: string;
  entered_at: string;
}

export interface ScoreBreakdown {
  groups: Record<GroupCode, number>;
  thirds: number;
  r32: number;
  r16: number;
  qf: number;
  sf: number;
  finalist: number;
  champion: number;
  group_stage_total: number;
  knockout_total: number;
  total: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  display_name: string;
  group_stage_score: number;
  knockout_score: number;
  total_score: number;
  is_pinned?: boolean;
}

// DynamoDB item shapes
export interface UserItem {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: number;
  id: string;
  display_name: string;
  email: string;
  is_admin: boolean;
  is_pinned?: boolean;
  created_at: string;
}

export interface EmailLookupItem {
  PK: string;
  SK: string;
  user_id: string;
}

export interface MagicTokenItem {
  PK: string;
  SK: string;
  user_id: string;
  expires_at: string;
  used: boolean;
}

export interface GroupPickItem {
  PK: string;
  SK: string;
  group_code: GroupCode;
  first_place: string;
  second_place: string;
  third_place: string;
  fourth_place: string;
  locked: boolean;
  submitted_at: string;
}

export interface ThirdsPickItem {
  PK: string;
  SK: string;
  teams: string[];
  locked: boolean;
  submitted_at: string;
}

export interface KnockoutPicksItem {
  PK: string;
  SK: string;
  R16: string[];
  QF: string[];
  SF: string[];
  Final: string[];
  Champion: string;
  locked: boolean;
  submitted_at: string;
}

export interface GroupResultItem {
  PK: string;
  SK: string;
  group_code: GroupCode;
  first_place: string;
  second_place: string;
  third_place: string;
  fourth_place: string;
  entered_at: string;
}

export interface ThirdsResultItem {
  PK: string;
  SK: string;
  qualified_thirds: string[];
  bracket_slots: Record<string, string>;
  entered_at: string;
}

export interface KnockoutResultItem {
  PK: string;
  SK: string;
  R32Winners: string[];
  R16Winners: string[];
  QFWinners: string[];
  SFWinners: string[];
  champion: string;
  entered_at: string;
}

export interface ScoresItem {
  PK: string;
  SK: string;
  group_stage_score: number;
  knockout_score: number;
  total_score: number;
  breakdown: ScoreBreakdown;
  last_calculated: string;
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

export interface MatchResultItem {
  PK: string;
  SK: string;
  match_id: string;
  group_code: GroupCode;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  entered_at: string;
}
