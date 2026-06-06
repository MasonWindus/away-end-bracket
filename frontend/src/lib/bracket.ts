import { THIRDS_SCENARIOS } from "../data/thirdsScenarios";
import type { GroupPick } from "../types";

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
