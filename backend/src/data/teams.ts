import { GroupCode } from "../types";

export interface Team {
  code: string;
  name: string;
}

export const GROUPS: Record<GroupCode, Team[]> = {
  A: [
    { code: "MEX", name: "Mexico" },
    { code: "RSA", name: "South Africa" },
    { code: "KOR", name: "Korea Republic" },
    { code: "CZE", name: "Czechia" },
  ],
  B: [
    { code: "CAN", name: "Canada" },
    { code: "BIH", name: "Bosnia and Herzegovina" },
    { code: "QAT", name: "Qatar" },
    { code: "SUI", name: "Switzerland" },
  ],
  C: [
    { code: "BRA", name: "Brazil" },
    { code: "MAR", name: "Morocco" },
    { code: "HTI", name: "Haiti" },
    { code: "SCO", name: "Scotland" },
  ],
  D: [
    { code: "USA", name: "United States" },
    { code: "PAR", name: "Paraguay" },
    { code: "AUS", name: "Australia" },
    { code: "TUR", name: "Türkiye" },
  ],
  E: [
    { code: "GER", name: "Germany" },
    { code: "CIV", name: "Ivory Coast" },
    { code: "ECU", name: "Ecuador" },
    { code: "CUW", name: "Curaçao" },
  ],
  F: [
    { code: "NED", name: "Netherlands" },
    { code: "SWE", name: "Sweden" },
    { code: "TUN", name: "Tunisia" },
    { code: "JPN", name: "Japan" },
  ],
  G: [
    { code: "BEL", name: "Belgium" },
    { code: "EGY", name: "Egypt" },
    { code: "IRN", name: "Iran" },
    { code: "NZL", name: "New Zealand" },
  ],
  H: [
    { code: "ESP", name: "Spain" },
    { code: "CPV", name: "Cape Verde" },
    { code: "KSA", name: "Saudi Arabia" },
    { code: "URU", name: "Uruguay" },
  ],
  I: [
    { code: "FRA", name: "France" },
    { code: "SEN", name: "Senegal" },
    { code: "IRQ", name: "Iraq" },
    { code: "NOR", name: "Norway" },
  ],
  J: [
    { code: "ARG", name: "Argentina" },
    { code: "ALG", name: "Algeria" },
    { code: "AUT", name: "Austria" },
    { code: "JOR", name: "Jordan" },
  ],
  K: [
    { code: "POR", name: "Portugal" },
    { code: "COD", name: "DR Congo" },
    { code: "UZB", name: "Uzbekistan" },
    { code: "COL", name: "Colombia" },
  ],
  L: [
    { code: "ENG", name: "England" },
    { code: "CRO", name: "Croatia" },
    { code: "GHA", name: "Ghana" },
    { code: "PAN", name: "Panama" },
  ],
};

export const TEAM_NAMES: Record<string, string> = Object.values(GROUPS)
  .flat()
  .reduce<Record<string, string>>((acc, team) => {
    acc[team.code] = team.name;
    return acc;
  }, {});

export const ALL_TEAMS: Team[] = Object.values(GROUPS).flat();

export function getGroupForTeam(teamCode: string): GroupCode | undefined {
  for (const [groupCode, teams] of Object.entries(GROUPS)) {
    if (teams.some((t) => t.code === teamCode)) {
      return groupCode as GroupCode;
    }
  }
  return undefined;
}

export function isValidTeamForGroup(teamCode: string, groupCode: GroupCode): boolean {
  return GROUPS[groupCode].some((t) => t.code === teamCode);
}
