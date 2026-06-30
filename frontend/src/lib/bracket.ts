import { THIRDS_SCENARIOS } from "../data/thirdsScenarios";
import type { GroupPick, KnockoutPicks, KnockoutResult } from "../types";

// Build the 32-team R32 field using the official FIFA 2026 bracket.
// thirdsSlots: admin-assigned overrides (post-group-stage); defaults to {}
// When not overridden, uses the official FIFA scenario table to map each
// qualifying 3rd-place team to the correct bracket slot based on their group.
export function buildR32Field(
  groupPicks: GroupPick[],
  thirdsPick: { teams: string[] } | null,
  thirdsSlots: Record<number, string> = {}
): string[] {
  const pickMap: Record<string, GroupPick> = {};
  for (const p of groupPicks) {
    pickMap[p.group_code] = p;
  }

  function winner(g: string): string {
    return pickMap[g]?.first_place || "TBD";
  }
  function runnerUp(g: string): string {
    return pickMap[g]?.second_place || "TBD";
  }

  // Resolve thirds slots: admin override first, then scenario-table lookup
  const resolved: Record<number, string> = { ...thirdsSlots };

  if (thirdsPick && thirdsPick.teams.length === 8) {
    // Map each selected third-place team back to its group
    const teamToGroup: Record<string, string> = {};
    for (const p of groupPicks) {
      if (p.third_place) teamToGroup[p.third_place] = p.group_code;
    }

    const qualifyingGroups: string[] = [];
    for (const teamCode of thirdsPick.teams) {
      const group = teamToGroup[teamCode];
      if (group) qualifyingGroups.push(group);
    }

    if (qualifyingGroups.length === 8) {
      const key = [...qualifyingGroups].sort().join("");
      const scenario = THIRDS_SCENARIOS[key];
      if (scenario) {
        // scenario[i] = group whose 3rd-place team fills slot T(i+1)
        for (let i = 0; i < 8; i++) {
          const slot = i + 1;
          if (resolved[slot]) continue; // admin override takes priority
          const group = scenario[i];
          resolved[slot] = pickMap[group]?.third_place || "TBD";
        }
      }
    }
  }

  function thirdSlot(slot: number): string {
    return resolved[slot] || "TBD";
  }

  // Official FIFA 2026 R32 bracket
  // M1: 1E vs T1  M2: 1I vs T2  M3: 2A vs 2B  M4: 1F vs 2C
  // M5: 2K vs 2L  M6: 1H vs 2J  M7: 1D vs T3  M8: 1G vs T4
  // M9: 1C vs 2F  M10:2E vs 2I  M11:1A vs T5  M12:1L vs T6
  // M13:1J vs 2H  M14:2D vs 2G  M15:1B vs T7  M16:1K vs T8
  return [
    winner("E"),   thirdSlot(1),
    winner("I"),   thirdSlot(2),
    runnerUp("A"), runnerUp("B"),
    winner("F"),   runnerUp("C"),
    runnerUp("K"), runnerUp("L"),
    winner("H"),   runnerUp("J"),
    winner("D"),   thirdSlot(3),
    winner("G"),   thirdSlot(4),
    winner("C"),   runnerUp("F"),
    runnerUp("E"), runnerUp("I"),
    winner("A"),   thirdSlot(5),
    winner("L"),   thirdSlot(6),
    winner("J"),   runnerUp("H"),
    runnerUp("D"), runnerUp("G"),
    winner("B"),   thirdSlot(7),
    winner("K"),   thirdSlot(8),
  ];
}

// Map actual results into slot-ordered KnockoutPicks so per-match bracket logic
// (e.g. which specific team lost which specific match) works against real results.
// Traverses the bracket tree to handle unordered admin input correctly.
export function deriveActualPicks(r32Field: string[], result: KnockoutResult): KnockoutPicks {
  const r32Set = new Set(result.R32Winners);
  const R16 = Array.from({ length: 16 }, (_, i) => {
    const a = r32Field[i * 2] || "";
    const b = r32Field[i * 2 + 1] || "";
    return (a && r32Set.has(a)) ? a : (b && r32Set.has(b)) ? b : "";
  });

  const r16Set = new Set(result.R16Winners);
  const QF = Array.from({ length: 8 }, (_, i) => {
    const a = R16[i * 2] || "";
    const b = R16[i * 2 + 1] || "";
    return (a && r16Set.has(a)) ? a : (b && r16Set.has(b)) ? b : "";
  });

  const qfSet = new Set(result.QFWinners);
  const SF = Array.from({ length: 4 }, (_, i) => {
    const a = QF[i * 2] || "";
    const b = QF[i * 2 + 1] || "";
    return (a && qfSet.has(a)) ? a : (b && qfSet.has(b)) ? b : "";
  });

  const sfSet = new Set(result.SFWinners);
  const Final = Array.from({ length: 2 }, (_, i) => {
    const a = SF[i * 2] || "";
    const b = SF[i * 2 + 1] || "";
    return (a && sfSet.has(a)) ? a : (b && sfSet.has(b)) ? b : "";
  });

  return { R16, QF, SF, Final, Champion: result.champion || "", locked: true };
}

// For a round's paired entrants (e.g. R32 field, or QF entrants derived from
// deriveActualPicks), classify each entrant as having won, lost, or not yet
// played its match. A team is only "lost" once we know its specific opponent
// in the pair won — simply being absent from the round's winners list isn't
// enough, since that's equally true of a team whose match hasn't happened yet.
export type MatchTeamStatus = "won" | "lost" | "pending";

export function buildRoundStatusMap(entrantPairs: string[], winners: string[]): Map<string, MatchTeamStatus> {
  const winnersSet = new Set(winners);
  const map = new Map<string, MatchTeamStatus>();
  for (let i = 0; i < entrantPairs.length; i += 2) {
    const a = entrantPairs[i];
    const b = entrantPairs[i + 1];
    const aValid = !!a && a !== "TBD";
    const bValid = !!b && b !== "TBD";
    const matchDecided = (aValid && winnersSet.has(a)) || (bValid && winnersSet.has(b));
    if (aValid) map.set(a, winnersSet.has(a) ? "won" : matchDecided ? "lost" : "pending");
    if (bValid) map.set(b, winnersSet.has(b) ? "won" : matchDecided ? "lost" : "pending");
  }
  return map;
}
