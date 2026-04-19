import { GroupCode, GroupPick } from "../types";

export interface GroupSlot {
  type: "group";
  group: GroupCode;
  place: 1 | 2;
}

export interface ThirdSlot {
  type: "third";
  slot: number;
}

export type MatchSlot = GroupSlot | ThirdSlot;

export interface R32Match {
  id: string;
  home: MatchSlot;
  away: MatchSlot;
}

export const R32_MATCHES: R32Match[] = [
  { id: "R32-M1",  home: { type: "group", group: "A", place: 1 }, away: { type: "third", slot: 1 } },
  { id: "R32-M2",  home: { type: "group", group: "B", place: 2 }, away: { type: "group", group: "A", place: 2 } },
  { id: "R32-M3",  home: { type: "group", group: "B", place: 1 }, away: { type: "third", slot: 2 } },
  { id: "R32-M4",  home: { type: "group", group: "C", place: 1 }, away: { type: "group", group: "C", place: 2 } },
  { id: "R32-M5",  home: { type: "group", group: "D", place: 1 }, away: { type: "third", slot: 3 } },
  { id: "R32-M6",  home: { type: "group", group: "E", place: 2 }, away: { type: "group", group: "D", place: 2 } },
  { id: "R32-M7",  home: { type: "group", group: "E", place: 1 }, away: { type: "third", slot: 4 } },
  { id: "R32-M8",  home: { type: "group", group: "F", place: 1 }, away: { type: "group", group: "F", place: 2 } },
  { id: "R32-M9",  home: { type: "group", group: "G", place: 1 }, away: { type: "third", slot: 5 } },
  { id: "R32-M10", home: { type: "group", group: "H", place: 2 }, away: { type: "group", group: "G", place: 2 } },
  { id: "R32-M11", home: { type: "group", group: "H", place: 1 }, away: { type: "third", slot: 6 } },
  { id: "R32-M12", home: { type: "group", group: "I", place: 1 }, away: { type: "group", group: "I", place: 2 } },
  { id: "R32-M13", home: { type: "group", group: "J", place: 1 }, away: { type: "third", slot: 7 } },
  { id: "R32-M14", home: { type: "group", group: "K", place: 2 }, away: { type: "group", group: "J", place: 2 } },
  { id: "R32-M15", home: { type: "group", group: "K", place: 1 }, away: { type: "third", slot: 8 } },
  { id: "R32-M16", home: { type: "group", group: "L", place: 1 }, away: { type: "group", group: "L", place: 2 } },
];

export interface R16Match {
  id: string;
  from: [string, string];
}

export const R16_MATCH_PAIRS: R16Match[] = [
  { id: "R16-M1", from: ["R32-M1", "R32-M2"] },
  { id: "R16-M2", from: ["R32-M3", "R32-M4"] },
  { id: "R16-M3", from: ["R32-M5", "R32-M6"] },
  { id: "R16-M4", from: ["R32-M7", "R32-M8"] },
  { id: "R16-M5", from: ["R32-M9", "R32-M10"] },
  { id: "R16-M6", from: ["R32-M11", "R32-M12"] },
  { id: "R16-M7", from: ["R32-M13", "R32-M14"] },
  { id: "R16-M8", from: ["R32-M15", "R32-M16"] },
];

export interface QFMatch {
  id: string;
  from: [string, string];
}

export const QF_MATCH_PAIRS: QFMatch[] = [
  { id: "QF-M1", from: ["R16-M1", "R16-M2"] },
  { id: "QF-M2", from: ["R16-M3", "R16-M4"] },
  { id: "QF-M3", from: ["R16-M5", "R16-M6"] },
  { id: "QF-M4", from: ["R16-M7", "R16-M8"] },
];

export interface SFMatch {
  id: string;
  from: [string, string];
}

export const SF_MATCH_PAIRS: SFMatch[] = [
  { id: "SF-M1", from: ["QF-M1", "QF-M2"] },
  { id: "SF-M2", from: ["QF-M3", "QF-M4"] },
];

export const FINAL_MATCH = {
  id: "FINAL",
  from: ["SF-M1", "SF-M2"] as [string, string],
};

/**
 * Build the 32-team R32 field for a user from their group picks and thirds picks.
 * This is: 1st + 2nd from each group pick (24 teams) + 8 thirds picks = 32 teams.
 */
export function getR32Field(
  groupPicks: Record<string, GroupPick>,
  thirdsPicks: string[]
): string[] {
  const field: string[] = [];

  // Add 1st and 2nd place from each group pick (A through L)
  const groups: GroupCode[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  for (const group of groups) {
    const pick = groupPicks[group];
    if (pick) {
      if (pick.first_place) field.push(pick.first_place);
      if (pick.second_place) field.push(pick.second_place);
    }
  }

  // Add the 8 thirds picks
  for (const team of thirdsPicks) {
    if (team && !field.includes(team)) {
      field.push(team);
    }
  }

  return field;
}
