export const GROUPS: Record<string, { code: string; name: string }[]> = {
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

export const TEAM_NAMES: Record<string, string> = {
  MEX: "Mexico",
  RSA: "South Africa",
  KOR: "Korea Republic",
  CZE: "Czechia",
  CAN: "Canada",
  BIH: "Bosnia and Herzegovina",
  QAT: "Qatar",
  SUI: "Switzerland",
  BRA: "Brazil",
  MAR: "Morocco",
  HTI: "Haiti",
  SCO: "Scotland",
  USA: "United States",
  PAR: "Paraguay",
  AUS: "Australia",
  TUR: "Türkiye",
  GER: "Germany",
  CIV: "Ivory Coast",
  ECU: "Ecuador",
  CUW: "Curaçao",
  NED: "Netherlands",
  SWE: "Sweden",
  TUN: "Tunisia",
  JPN: "Japan",
  BEL: "Belgium",
  EGY: "Egypt",
  IRN: "Iran",
  NZL: "New Zealand",
  ESP: "Spain",
  CPV: "Cape Verde",
  KSA: "Saudi Arabia",
  URU: "Uruguay",
  FRA: "France",
  SEN: "Senegal",
  IRQ: "Iraq",
  NOR: "Norway",
  ARG: "Argentina",
  ALG: "Algeria",
  AUT: "Austria",
  JOR: "Jordan",
  POR: "Portugal",
  COD: "DR Congo",
  UZB: "Uzbekistan",
  COL: "Colombia",
  ENG: "England",
  CRO: "Croatia",
  GHA: "Ghana",
  PAN: "Panama",
};

export const TEAM_FLAGS: Record<string, string> = {
  MEX: "mx",  RSA: "za",     KOR: "kr",     CZE: "cz",
  CAN: "ca",  BIH: "ba",     QAT: "qa",     SUI: "ch",
  BRA: "br",  MAR: "ma",     HTI: "ht",     SCO: "gb-sct",
  USA: "us",  PAR: "py",     AUS: "au",     TUR: "tr",
  GER: "de",  CIV: "ci",     ECU: "ec",     CUW: "cw",
  NED: "nl",  SWE: "se",     TUN: "tn",     JPN: "jp",
  BEL: "be",  EGY: "eg",     IRN: "ir",     NZL: "nz",
  ESP: "es",  CPV: "cv",     KSA: "sa",     URU: "uy",
  FRA: "fr",  SEN: "sn",     IRQ: "iq",     NOR: "no",
  ARG: "ar",  ALG: "dz",     AUT: "at",     JOR: "jo",
  POR: "pt",  COD: "cd",     UZB: "uz",     COL: "co",
  ENG: "gb-eng", CRO: "hr", GHA: "gh",     PAN: "pa",
};

export const GROUP_CODES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;

// R32 bracket matchups (32-team format with 12 groups + 8 best thirds)
// Matches 1-16, using group winners (W), runners-up (RU), and thirds slots (T1-T8)
export interface BracketMatchup {
  matchId: number;
  teamA: { type: "W" | "RU" | "T"; group?: string; thirdSlot?: number };
  teamB: { type: "W" | "RU" | "T"; group?: string; thirdSlot?: number };
}

export const R32_MATCHUPS: BracketMatchup[] = [
  { matchId: 1,  teamA: { type: "W",  group: "A" },              teamB: { type: "T", thirdSlot: 1 } },
  { matchId: 2,  teamA: { type: "RU", group: "B" },              teamB: { type: "RU", group: "A" } },
  { matchId: 3,  teamA: { type: "W",  group: "B" },              teamB: { type: "T", thirdSlot: 2 } },
  { matchId: 4,  teamA: { type: "W",  group: "C" },              teamB: { type: "RU", group: "C" } },
  { matchId: 5,  teamA: { type: "W",  group: "D" },              teamB: { type: "T", thirdSlot: 3 } },
  { matchId: 6,  teamA: { type: "RU", group: "E" },              teamB: { type: "RU", group: "D" } },
  { matchId: 7,  teamA: { type: "W",  group: "E" },              teamB: { type: "T", thirdSlot: 4 } },
  { matchId: 8,  teamA: { type: "W",  group: "F" },              teamB: { type: "RU", group: "F" } },
  { matchId: 9,  teamA: { type: "W",  group: "G" },              teamB: { type: "T", thirdSlot: 5 } },
  { matchId: 10, teamA: { type: "RU", group: "H" },              teamB: { type: "RU", group: "G" } },
  { matchId: 11, teamA: { type: "W",  group: "H" },              teamB: { type: "T", thirdSlot: 6 } },
  { matchId: 12, teamA: { type: "W",  group: "I" },              teamB: { type: "RU", group: "I" } },
  { matchId: 13, teamA: { type: "W",  group: "J" },              teamB: { type: "T", thirdSlot: 7 } },
  { matchId: 14, teamA: { type: "RU", group: "K" },              teamB: { type: "RU", group: "J" } },
  { matchId: 15, teamA: { type: "W",  group: "K" },              teamB: { type: "T", thirdSlot: 8 } },
  { matchId: 16, teamA: { type: "W",  group: "L" },              teamB: { type: "RU", group: "L" } },
];
