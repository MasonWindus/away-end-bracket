import React from "react";
import type { KnockoutPicks } from "../types";
import { TEAM_NAMES } from "../data/teams";
import TeamFlag from "./TeamFlag";

interface BracketViewProps {
  /** 32 team codes in bracket order (index 0-31, pair i*2 vs i*2+1 = match i+1) */
  r32Field: string[];
  /** bracket slot -> team code (from admin thirds assignment) */
  thirdsSlots: Record<number, string>;
  picks: KnockoutPicks;
  onPicksChange: (picks: KnockoutPicks) => void;
  locked: boolean;
  knockoutResults?: {
    R16?: string[];
    QF?: string[];
    SF?: string[];
    Final?: string[];
    Champion?: string;
  };
}

function teamName(code: string) {
  if (!code || code === "TBD") return "TBD";
  return TEAM_NAMES[code] || code;
}

// Build the 16 R32 matchups from the r32Field array
// r32Field[0] vs r32Field[1] = match 1, etc.
function buildR32Matches(r32Field: string[]): Array<[string, string]> {
  const matches: Array<[string, string]> = [];
  for (let i = 0; i < 16; i++) {
    matches.push([r32Field[i * 2] || "TBD", r32Field[i * 2 + 1] || "TBD"]);
  }
  return matches;
}

// Given picks, get which team won a specific R32 match
function getR16Team(picks: KnockoutPicks, matchIdx: number): string {
  return picks.R16[matchIdx] || "";
}

// Build R16 matches from R16 picks: match i uses R16[i*2] vs R16[i*2+1]
function buildR16Matches(r16Teams: string[]): Array<[string, string]> {
  const matches: Array<[string, string]> = [];
  for (let i = 0; i < 8; i++) {
    matches.push([r16Teams[i * 2] || "", r16Teams[i * 2 + 1] || ""]);
  }
  return matches;
}

function buildQFMatches(qfTeams: string[]): Array<[string, string]> {
  const matches: Array<[string, string]> = [];
  for (let i = 0; i < 4; i++) {
    matches.push([qfTeams[i * 2] || "", qfTeams[i * 2 + 1] || ""]);
  }
  return matches;
}

function buildSFMatches(sfTeams: string[]): Array<[string, string]> {
  return [
    [sfTeams[0] || "", sfTeams[1] || ""],
    [sfTeams[2] || "", sfTeams[3] || ""],
  ];
}

interface TeamButtonProps {
  code: string;
  isWinner: boolean;
  isLoser: boolean;
  isTBD: boolean;
  disabled: boolean;
  onClick: () => void;
  compact?: boolean;
}

function TeamButton({ code, isWinner, isLoser, isTBD, disabled, onClick, compact }: TeamButtonProps) {
  const name = teamName(code);
  const displayName = compact && name.length > 14 ? name.slice(0, 13) + "…" : name;

  return (
    <button
      onClick={onClick}
      disabled={disabled || isTBD || !code}
      title={name}
      className={`w-full text-left px-2 py-1.5 text-xs font-medium rounded transition-all duration-100 border ${
        isTBD || !code
          ? "bg-away-forest/50 border-away-moss/50 text-away-cream/30 cursor-not-allowed italic"
          : isWinner
          ? "bg-away-gold/30 border-away-gold text-away-cream cursor-default shadow shadow-away-forest"
          : isLoser
          ? "bg-away-forest border-away-moss/50 text-away-cream/30 line-through cursor-default"
          : disabled
          ? "bg-away-green border-away-moss text-away-cream/40 cursor-not-allowed"
          : "bg-away-green border-away-moss text-away-cream/80 hover:bg-away-moss hover:border-away-gold cursor-pointer"
      }`}
    >
      <span className="flex items-center gap-1">
        {isWinner && (
          <svg className="w-3 h-3 text-away-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {!isTBD && code && <span className="shrink-0 leading-none"><TeamFlag code={code} /></span>}
        <span className="truncate">{isTBD || !code ? "TBD" : displayName}</span>
      </span>
    </button>
  );
}

interface MatchBoxProps {
  label?: string;
  teamA: string;
  teamB: string;
  winner: string;
  onPick: (team: string) => void;
  locked: boolean;
  compact?: boolean;
}

function MatchBox({ label, teamA, teamB, winner, onPick, locked, compact }: MatchBoxProps) {
  const aTBD = !teamA || teamA === "TBD";
  const bTBD = !teamB || teamB === "TBD";

  return (
    <div className="bg-away-green border border-away-moss rounded-lg overflow-hidden min-w-[130px]">
      {label && (
        <div className="bg-away-moss border-b border-away-green px-2 py-0.5">
          <span className="text-away-cream/50 text-[10px] font-medium uppercase tracking-wider">{label}</span>
        </div>
      )}
      <div className="p-1.5 space-y-1">
        <TeamButton
          code={teamA}
          isWinner={!!(winner && winner === teamA)}
          isLoser={!!(winner && winner !== teamA && !aTBD)}
          isTBD={aTBD}
          disabled={locked || aTBD || bTBD}
          onClick={() => onPick(teamA)}
          compact={compact}
        />
        <div className="text-center text-[9px] text-away-cream/30 font-medium">vs</div>
        <TeamButton
          code={teamB}
          isWinner={!!(winner && winner === teamB)}
          isLoser={!!(winner && winner !== teamB && !bTBD)}
          isTBD={bTBD}
          disabled={locked || aTBD || bTBD}
          onClick={() => onPick(teamB)}
          compact={compact}
        />
      </div>
    </div>
  );
}

export default function BracketView({
  r32Field,
  thirdsSlots,
  picks,
  onPicksChange,
  locked,
  knockoutResults,
}: BracketViewProps) {
  const r32Matches = buildR32Matches(r32Field);

  // ---- R32 pick handler ----
  function pickR32Winner(matchIdx: number, team: string) {
    if (locked) return;
    const newR16 = [...picks.R16];
    const loser = r32Matches[matchIdx][0] === team ? r32Matches[matchIdx][1] : r32Matches[matchIdx][0];

    newR16[matchIdx] = team;

    // Remove this team / loser from downstream picks if they were there
    const newQF = picks.QF.map((t) => (t === loser ? "" : t));
    const newSF = picks.SF.map((t) => (t === loser ? "" : t));
    const newFinal = picks.Final.map((t) => (t === loser ? "" : t));
    const newChampion = picks.Champion === loser ? "" : picks.Champion;

    // Also clear if the team changes (old R16 winner in that slot)
    const oldR16Winner = picks.R16[matchIdx];
    if (oldR16Winner && oldR16Winner !== team) {
      const r16SlotInR16Match = Math.floor(matchIdx / 2);
      // This old R16 winner was feeding into a QF slot
      const qfIdx = r16SlotInR16Match;
      newQF[qfIdx] = "";
      const sfIdx = Math.floor(qfIdx / 2);
      newSF[sfIdx] = "";
      const finalIdx = Math.floor(sfIdx / 2);
      newFinal[finalIdx] = "";
    }

    onPicksChange({ ...picks, R16: newR16, QF: newQF, SF: newSF, Final: newFinal, Champion: newChampion });
  }

  // ---- R16 (= advancing from R32) -> QF ----
  // R16 teams: picks.R16[0..15]
  // R16 match i: R16[i*2] vs R16[i*2+1]
  function pickR16Winner(r16MatchIdx: number, team: string) {
    if (locked) return;
    const newQF = [...picks.QF];
    const r16Match = [picks.R16[r16MatchIdx * 2], picks.R16[r16MatchIdx * 2 + 1]];
    const loser = r16Match[0] === team ? r16Match[1] : r16Match[0];

    newQF[r16MatchIdx] = team;

    // Clear loser from downstream
    const newSF = picks.SF.map((t) => (t === loser ? "" : t));
    const newFinal = picks.Final.map((t) => (t === loser ? "" : t));
    const newChampion = picks.Champion === loser ? "" : picks.Champion;

    // Also clear old QF winner from downstream if changed
    const oldQFWinner = picks.QF[r16MatchIdx];
    if (oldQFWinner && oldQFWinner !== team) {
      const sfIdx = Math.floor(r16MatchIdx / 2);
      newSF[sfIdx] = "";
      const finalIdx = Math.floor(sfIdx / 2);
      newFinal[finalIdx] = "";
    }

    onPicksChange({ ...picks, QF: newQF, SF: newSF, Final: newFinal, Champion: newChampion });
  }

  // ---- QF teams -> SF ----
  function pickQFWinner(qfMatchIdx: number, team: string) {
    if (locked) return;
    const newSF = [...picks.SF];
    const qfMatch = [picks.QF[qfMatchIdx * 2], picks.QF[qfMatchIdx * 2 + 1]];
    const loser = qfMatch[0] === team ? qfMatch[1] : qfMatch[0];

    newSF[qfMatchIdx] = team;

    const newFinal = picks.Final.map((t) => (t === loser ? "" : t));
    const newChampion = picks.Champion === loser ? "" : picks.Champion;

    const oldSFWinner = picks.SF[qfMatchIdx];
    if (oldSFWinner && oldSFWinner !== team) {
      const finalIdx = Math.floor(qfMatchIdx / 2);
      newFinal[finalIdx] = "";
    }

    onPicksChange({ ...picks, SF: newSF, Final: newFinal, Champion: newChampion });
  }

  // ---- SF teams -> Final ----
  function pickSFWinner(sfMatchIdx: number, team: string) {
    if (locked) return;
    const newFinal = [...picks.Final];
    const sfMatch = [picks.SF[sfMatchIdx * 2], picks.SF[sfMatchIdx * 2 + 1]];
    const loser = sfMatch[0] === team ? sfMatch[1] : sfMatch[0];

    newFinal[sfMatchIdx] = team;

    const newChampion = picks.Champion === loser ? "" : picks.Champion;

    const oldFinalTeam = picks.Final[sfMatchIdx];
    if (oldFinalTeam && oldFinalTeam !== team) {
      // Remove old finalist from champion if they were picked
    }

    onPicksChange({ ...picks, Final: newFinal, Champion: newChampion });
  }

  // ---- Final -> Champion ----
  function pickChampion(team: string) {
    if (locked) return;
    onPicksChange({ ...picks, Champion: team === picks.Champion ? "" : team });
  }

  const SLOT_H = 132; // px — base slot height for one R32 match; each subsequent round doubles this

  const r32Left = r32Matches.slice(0, 8);   // matches 1-8 (left half)
  const r32Right = r32Matches.slice(8, 16); // matches 9-16 (right half)

  // Build R16 match data for left (0-3) and right (4-7)
  const r16Left = buildR16Matches(picks.R16).slice(0, 4);
  const r16Right = buildR16Matches(picks.R16).slice(4, 8);

  const qfLeft = buildQFMatches(picks.QF).slice(0, 2);
  const qfRight = buildQFMatches(picks.QF).slice(2, 4);

  const sfMatches = buildSFMatches(picks.SF);

  return (
    <div className="space-y-4">
      {locked && (
        <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-3 py-2">
          <span className="text-yellow-500 text-sm">Picks are locked — viewing read-only bracket.</span>
        </div>
      )}

      {!locked && (
        <p className="text-away-cream/60 text-sm">
          Click a team to advance them to the next round. Work left-to-right through the bracket.
        </p>
      )}

      {/* Champion display */}
      {picks.Champion && (
        <div className="bg-away-gold/20 border border-away-gold rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🏆</span>
          <div>
            <p className="text-away-gold text-xs font-bold uppercase tracking-wider">Your Champion Pick</p>
            <p className="text-away-cream font-bold text-lg flex items-center gap-1.5"><TeamFlag code={picks.Champion} /> {teamName(picks.Champion)}</p>
          </div>
        </div>
      )}

      {/* Bracket */}
      <div className="pb-4">
        {/*
          Slot-based bracket layout: each round's matches sit in a "slot" whose height
          doubles each round. R32 slot = SLOT_H, R16 = 2×, QF = 4×, SF = 8×.
          All columns have the same total data height (8 × SLOT_H), so every match
          is vertically centered between the two matches that feed into it.
        */}
        <div className="flex gap-2">
            {/* R32 Left — 8 matches, slot height = 1× */}
            <div className="flex flex-col flex-1">
              <div className="text-away-cream/40 text-[10px] font-bold uppercase tracking-widest text-center mb-1">Round of 32</div>
              {r32Left.map((match, i) => (
                <div key={i} style={{ height: `${SLOT_H}px` }} className="flex items-center">
                  <div className="w-full">
                    <MatchBox
                      label={`M${i + 1}`}
                      teamA={match[0]}
                      teamB={match[1]}
                      winner={picks.R16[i] || ""}
                      onPick={(team) => pickR32Winner(i, team)}
                      locked={locked}
                      compact
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* R16 Left — 4 matches, slot height = 2× */}
            <div className="flex flex-col flex-1">
              <div className="text-away-cream/40 text-[10px] font-bold uppercase tracking-widest text-center mb-1">Round of 16</div>
              {r16Left.map((match, i) => (
                <div key={i} style={{ height: `${SLOT_H * 2}px` }} className="flex items-center">
                  <div className="w-full">
                    <MatchBox
                      label={`R16-${i + 1}`}
                      teamA={match[0]}
                      teamB={match[1]}
                      winner={picks.QF[i] || ""}
                      onPick={(team) => pickR16Winner(i, team)}
                      locked={locked}
                      compact
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* QF Left — 2 matches, slot height = 4× */}
            <div className="flex flex-col flex-1">
              <div className="text-away-cream/40 text-[10px] font-bold uppercase tracking-widest text-center mb-1">Quarterfinals</div>
              {qfLeft.map((match, i) => (
                <div key={i} style={{ height: `${SLOT_H * 4}px` }} className="flex items-center">
                  <div className="w-full">
                    <MatchBox
                      label={`QF-${i + 1}`}
                      teamA={match[0]}
                      teamB={match[1]}
                      winner={picks.SF[i] || ""}
                      onPick={(team) => pickQFWinner(i, team)}
                      locked={locked}
                      compact
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* SF Left — 1 match, slot height = 8× */}
            <div className="flex flex-col flex-1">
              <div className="text-away-cream/40 text-[10px] font-bold uppercase tracking-widest text-center mb-1">Semifinals</div>
              <div style={{ height: `${SLOT_H * 8}px` }} className="flex items-center">
                <div className="w-full">
                  <MatchBox
                    label="SF-1"
                    teamA={sfMatches[0][0]}
                    teamB={sfMatches[0][1]}
                    winner={picks.Final[0] || ""}
                    onPick={(team) => pickSFWinner(0, team)}
                    locked={locked}
                    compact
                  />
                </div>
              </div>
            </div>

            {/* Final + Champion (center) — full height slot */}
            <div className="flex flex-col items-center flex-1">
              <div className="text-away-gold text-[10px] font-bold uppercase tracking-widest text-center mb-1">
                🏆 Final
              </div>
              <div style={{ height: `${SLOT_H * 8}px` }} className="flex flex-col items-center justify-center gap-3 px-2 w-full">
                <MatchBox
                  label="FINAL"
                  teamA={picks.Final[0] || ""}
                  teamB={picks.Final[1] || ""}
                  winner={picks.Champion || ""}
                  onPick={(team) => pickChampion(team)}
                  locked={locked}
                  compact
                />
                {picks.Champion && (
                  <div className="mt-2 bg-away-gold/20 border border-away-gold/50 rounded-lg p-2 text-center w-full">
                    <p className="text-away-gold text-[10px] font-bold uppercase">Champion</p>
                    <p className="text-away-cream text-xs font-bold mt-0.5">{teamName(picks.Champion)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* SF Right — 1 match, slot height = 8× */}
            <div className="flex flex-col flex-1">
              <div className="text-away-cream/40 text-[10px] font-bold uppercase tracking-widest text-center mb-1">Semifinals</div>
              <div style={{ height: `${SLOT_H * 8}px` }} className="flex items-center">
                <div className="w-full">
                  <MatchBox
                    label="SF-2"
                    teamA={sfMatches[1][0]}
                    teamB={sfMatches[1][1]}
                    winner={picks.Final[1] || ""}
                    onPick={(team) => pickSFWinner(1, team)}
                    locked={locked}
                    compact
                  />
                </div>
              </div>
            </div>

            {/* QF Right — 2 matches, slot height = 4× */}
            <div className="flex flex-col flex-1">
              <div className="text-away-cream/40 text-[10px] font-bold uppercase tracking-widest text-center mb-1">Quarterfinals</div>
              {qfRight.map((match, i) => (
                <div key={i} style={{ height: `${SLOT_H * 4}px` }} className="flex items-center">
                  <div className="w-full">
                    <MatchBox
                      label={`QF-${i + 3}`}
                      teamA={match[0]}
                      teamB={match[1]}
                      winner={picks.SF[i + 2] || ""}
                      onPick={(team) => pickQFWinner(i + 2, team)}
                      locked={locked}
                      compact
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* R16 Right — 4 matches, slot height = 2× */}
            <div className="flex flex-col flex-1">
              <div className="text-away-cream/40 text-[10px] font-bold uppercase tracking-widest text-center mb-1">Round of 16</div>
              {r16Right.map((match, i) => (
                <div key={i} style={{ height: `${SLOT_H * 2}px` }} className="flex items-center">
                  <div className="w-full">
                    <MatchBox
                      label={`R16-${i + 5}`}
                      teamA={match[0]}
                      teamB={match[1]}
                      winner={picks.QF[i + 4] || ""}
                      onPick={(team) => pickR16Winner(i + 4, team)}
                      locked={locked}
                      compact
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* R32 Right — 8 matches, slot height = 1× */}
            <div className="flex flex-col flex-1">
              <div className="text-away-cream/40 text-[10px] font-bold uppercase tracking-widest text-center mb-1">Round of 32</div>
              {r32Right.map((match, i) => (
                <div key={i} style={{ height: `${SLOT_H}px` }} className="flex items-center">
                  <div className="w-full">
                    <MatchBox
                      label={`M${i + 9}`}
                      teamA={match[0]}
                      teamB={match[1]}
                      winner={picks.R16[i + 8] || ""}
                      onPick={(team) => pickR32Winner(i + 8, team)}
                      locked={locked}
                      compact
                    />
                  </div>
                </div>
              ))}
            </div>
        </div>
      </div>

      {/* Progress summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
        {[
          { label: "R32 Picks", count: picks.R16.filter(Boolean).length, total: 16 },
          { label: "R16 Picks", count: picks.QF.filter(Boolean).length, total: 8 },
          { label: "QF Picks", count: picks.SF.filter(Boolean).length, total: 4 },
          { label: "SF Picks", count: picks.Final.filter(Boolean).length, total: 2 },
          { label: "Champion", count: picks.Champion ? 1 : 0, total: 1 },
        ].map(({ label, count, total }) => (
          <div
            key={label}
            className={`rounded-lg py-2 px-3 border ${
              count === total
                ? "bg-away-gold/20 border-away-gold/50"
                : "bg-away-green border-away-moss"
            }`}
          >
            <div className={`text-lg font-bold ${count === total ? "text-away-gold" : "text-away-cream/50"}`}>
              {count}/{total}
            </div>
            <div className="text-xs text-away-cream/40">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
