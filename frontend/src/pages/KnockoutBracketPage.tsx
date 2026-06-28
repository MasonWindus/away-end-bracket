import React, { useEffect, useRef, useState } from "react";
import { getKnockoutBracket, getKnockoutPicks } from "../lib/api";
import { buildR32Field } from "../lib/bracket";
import { TEAM_NAMES } from "../data/teams";
import TeamFlag from "../components/TeamFlag";
import { useAuth } from "../lib/auth";
import type { KnockoutResult, KnockoutPicks, GroupResult, ThirdsResult } from "../types";

const POLL_INTERVAL_MS = 30000;

type RoundKey = "R32" | "R16" | "QF" | "SF" | "Final";

const ROUNDS: { key: RoundKey; label: string; shortLabel: string; pts: number; count: number }[] = [
  { key: "R32",   label: "Round of 32",  shortLabel: "R32",   pts: 2,  count: 16 },
  { key: "R16",   label: "Round of 16",  shortLabel: "R16",   pts: 4,  count: 8  },
  { key: "QF",    label: "Quarterfinals", shortLabel: "QF",   pts: 6,  count: 4  },
  { key: "SF",    label: "Semifinals",   shortLabel: "SF",    pts: 10, count: 2  },
  { key: "Final", label: "Final",        shortLabel: "Final", pts: 0,  count: 1  },
];

// Map actual results into slot-ordered KnockoutPicks so BracketView-style logic works.
// Traverses the bracket tree to handle unordered admin input correctly.
function deriveActualPicks(r32Field: string[], result: KnockoutResult): KnockoutPicks {
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

interface MatchData {
  teamA: string;
  teamB: string;
  winner: string;
  userPick: string;
}

function getMatchesForRound(
  round: RoundKey,
  r32Field: string[],
  actual: KnockoutPicks,
  user: KnockoutPicks | null
): MatchData[] {
  switch (round) {
    case "R32":
      return Array.from({ length: 16 }, (_, i) => ({
        teamA: r32Field[i * 2] || "TBD",
        teamB: r32Field[i * 2 + 1] || "TBD",
        winner: actual.R16[i] || "",
        userPick: user?.R16[i] || "",
      }));
    case "R16":
      return Array.from({ length: 8 }, (_, i) => ({
        teamA: actual.R16[i * 2] || "",
        teamB: actual.R16[i * 2 + 1] || "",
        winner: actual.QF[i] || "",
        userPick: user?.QF[i] || "",
      }));
    case "QF":
      return Array.from({ length: 4 }, (_, i) => ({
        teamA: actual.QF[i * 2] || "",
        teamB: actual.QF[i * 2 + 1] || "",
        winner: actual.SF[i] || "",
        userPick: user?.SF[i] || "",
      }));
    case "SF":
      return Array.from({ length: 2 }, (_, i) => ({
        teamA: actual.SF[i * 2] || "",
        teamB: actual.SF[i * 2 + 1] || "",
        winner: actual.Final[i] || "",
        userPick: user?.Final[i] || "",
      }));
    case "Final":
      return [{ teamA: actual.Final[0] || "", teamB: actual.Final[1] || "", winner: actual.Champion || "", userPick: user?.Champion || "" }];
  }
}

// How many results exist per round (for tab indicators)
function roundResultCount(round: RoundKey, actual: KnockoutPicks): number {
  switch (round) {
    case "R32":   return actual.R16.filter(Boolean).length;
    case "R16":   return actual.QF.filter(Boolean).length;
    case "QF":    return actual.SF.filter(Boolean).length;
    case "SF":    return actual.Final.filter(Boolean).length;
    case "Final": return actual.Champion ? 1 : 0;
  }
}

// Default to the deepest round that has at least one result
function getDefaultRound(actual: KnockoutPicks): RoundKey {
  if (actual.Champion || actual.Final.some(Boolean)) return "Final";
  if (actual.SF.some(Boolean)) return "SF";
  if (actual.QF.some(Boolean)) return "QF";
  if (actual.R16.some(Boolean)) return "R16";
  return "R32";
}

// ─── Match card ───────────────────────────────────────────────────────────────

function TeamRow({
  team,
  isWinner,
  isLoser,
  userPicked,
  showPicks,
}: {
  team: string;
  isWinner: boolean;
  isLoser: boolean;
  userPicked: boolean;
  showPicks: boolean;
}) {
  const isTBD = !team || team === "TBD";
  const name = isTBD ? "TBD" : (TEAM_NAMES[team] || team);

  return (
    <div className={`flex items-center justify-between px-3 py-2.5 transition-colors ${
      isWinner ? "bg-away-gold/10" : ""
    }`}>
      <div className="flex items-center gap-2 min-w-0">
        {isWinner ? (
          <svg className="w-3.5 h-3.5 text-away-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <div className="w-3.5 shrink-0" />
        )}
        {!isTBD && <TeamFlag code={team} />}
        <span className={`text-sm font-medium truncate ${
          isTBD        ? "text-away-cream/25 italic" :
          isWinner     ? "text-away-gold font-semibold" :
          isLoser      ? "text-away-cream/35" :
          "text-away-cream/85"
        }`}>
          {name}
        </span>
      </div>
      {showPicks && userPicked && !isTBD && (
        <span className={`shrink-0 ml-2 text-[11px] font-bold px-1.5 py-0.5 rounded border ${
          isWinner
            ? "bg-emerald-900/40 text-emerald-400 border-emerald-600/50"
            : isLoser
            ? "bg-red-900/25 text-red-400/80 border-red-700/40"
            : "bg-away-moss text-away-cream/40 border-away-moss"
        }`}>
          {isWinner ? "✓" : isLoser ? "✗" : "?"}
        </span>
      )}
    </div>
  );
}

function MatchCard({
  match,
  matchNum,
  showPicks,
}: {
  match: MatchData;
  matchNum: number;
  showPicks: boolean;
}) {
  const { teamA, teamB, winner, userPick } = match;
  const played = !!winner;
  const aTBD = !teamA || teamA === "TBD";
  const bTBD = !teamB || teamB === "TBD";

  return (
    <div className="bg-away-green border border-away-moss rounded-xl overflow-hidden">
      <div className="bg-away-moss/60 px-3 py-1.5 flex items-center justify-between">
        <span className="text-away-cream/40 text-[10px] font-bold uppercase tracking-widest">
          Match {matchNum}
        </span>
        {!played && !aTBD && !bTBD && (
          <span className="text-away-cream/25 text-[10px]">Upcoming</span>
        )}
      </div>
      <TeamRow
        team={teamA}
        isWinner={played && teamA === winner}
        isLoser={played && teamA !== winner && !aTBD}
        userPicked={showPicks && !!userPick && userPick === teamA}
        showPicks={showPicks}
      />
      <div className="border-t border-b border-away-moss/40 py-0.5 text-center">
        <span className="text-away-cream/20 text-[10px] font-medium">vs</span>
      </div>
      <TeamRow
        team={teamB}
        isWinner={played && teamB === winner}
        isLoser={played && teamB !== winner && !bTBD}
        userPicked={showPicks && !!userPick && userPick === teamB}
        showPicks={showPicks}
      />
    </div>
  );
}

// ─── Final card (special layout for the championship) ────────────────────────

function FinalCard({
  match,
  showPicks,
}: {
  match: MatchData;
  showPicks: boolean;
}) {
  const { teamA, teamB, winner, userPick } = match;
  const played = !!winner;
  const aTBD = !teamA || teamA === "TBD";
  const bTBD = !teamB || teamB === "TBD";
  const nonChampion = played ? (winner === teamA ? teamB : teamA) : "";

  // Who did the user pick as the runner-up (finalist who didn't win champion)?
  // userPick here is the champion pick. The finalist pick comes from userPicks.Final.
  // We only have userPick (champion) available here, so show that.

  return (
    <div className="max-w-sm mx-auto space-y-3">
      {/* The match */}
      <div className="bg-away-green border border-away-moss rounded-xl overflow-hidden">
        <div className="bg-away-moss/60 px-3 py-1.5 text-center">
          <span className="text-away-gold text-[10px] font-bold uppercase tracking-widest">Final</span>
        </div>
        <TeamRow
          team={teamA}
          isWinner={played && teamA === winner}
          isLoser={played && teamA !== winner && !aTBD}
          userPicked={showPicks && !!userPick && userPick === teamA}
          showPicks={showPicks}
        />
        <div className="border-t border-b border-away-moss/40 py-0.5 text-center">
          <span className="text-away-cream/20 text-[10px] font-medium">vs</span>
        </div>
        <TeamRow
          team={teamB}
          isWinner={played && teamB === winner}
          isLoser={played && teamB !== winner && !bTBD}
          userPicked={showPicks && !!userPick && userPick === teamB}
          showPicks={showPicks}
        />
      </div>

      {/* Champion display */}
      {winner && (
        <div className="bg-away-gold/15 border border-away-gold/50 rounded-xl px-4 py-4 text-center">
          <p className="text-away-gold/60 text-[10px] font-bold uppercase tracking-widest mb-2">World Champion</p>
          <div className="flex items-center justify-center gap-2">
            <TeamFlag code={winner} />
            <span className="text-away-gold text-xl font-bold">{TEAM_NAMES[winner] || winner}</span>
          </div>
          {showPicks && userPick && (
            <div className={`mt-2 text-xs font-semibold ${userPick === winner ? "text-emerald-400" : "text-red-400/80"}`}>
              {userPick === winner
                ? "✓ You picked the champion!"
                : `✗ You picked ${TEAM_NAMES[userPick] || userPick}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Round summary bar ────────────────────────────────────────────────────────

function RoundSummary({
  matches,
  pts,
  round,
}: {
  matches: MatchData[];
  pts: number;
  round: RoundKey;
}) {
  const played = matches.filter((m) => m.winner);
  const correct = matches.filter((m) => m.winner && m.userPick && m.userPick === m.winner);

  if (played.length === 0) return null;

  if (round === "Final") {
    const finalMatch = matches[0];
    const championCorrect = finalMatch.winner && finalMatch.userPick === finalMatch.winner;
    const earned = championCorrect ? 20 : 0;
    return (
      <div className="flex items-center justify-between text-xs text-away-cream/50 mb-3">
        <span>{played.length === 1 ? "Final played" : "Final pending"}</span>
        {earned > 0 && <span className="text-away-gold font-bold">+{earned} pts</span>}
      </div>
    );
  }

  const earned = correct.length * pts;
  return (
    <div className="flex items-center justify-between text-xs text-away-cream/50 mb-3">
      <span>{played.length}/{matches.length} played · {correct.length} correct</span>
      {earned > 0 && <span className="text-away-gold font-bold">+{earned} pts</span>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const EMPTY_PICKS: KnockoutPicks = {
  R16: Array(16).fill(""),
  QF: Array(8).fill(""),
  SF: Array(4).fill(""),
  Final: Array(2).fill(""),
  Champion: "",
  locked: true,
};

export default function KnockoutBracketPage() {
  const { user } = useAuth();
  const [bracketData, setBracketData] = useState<{
    knockout_result: KnockoutResult | null;
    group_results: GroupResult[];
    thirds_result: ThirdsResult | null;
  } | null>(null);
  const [userPicks, setUserPicks] = useState<KnockoutPicks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showPicks, setShowPicks] = useState(false);
  const [selectedRound, setSelectedRound] = useState<RoundKey>("R32");
  const [roundKey, setRoundKey] = useState(0); // incremented to trigger slide animation
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const data = await getKnockoutBracket();
      setBracketData(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load bracket.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (user) {
      getKnockoutPicks().then(setUserPicks).catch(() => setUserPicks(null));
    } else {
      setUserPicks(null);
    }
  }, [user]);

  // Auto-advance selected round once data loads
  const [autoAdvanced, setAutoAdvanced] = useState(false);
  useEffect(() => {
    if (bracketData?.knockout_result && !autoAdvanced) {
      const actual = deriveActualPicks(
        buildR32Field(
          bracketData.group_results.map((r) => ({ ...r, locked: true })),
          bracketData.thirds_result ? { teams: bracketData.thirds_result.qualified_thirds } : null,
          bracketData.thirds_result
            ? Object.fromEntries(Object.entries(bracketData.thirds_result.bracket_slots).map(([k, v]) => [parseInt(k), v]))
            : {}
        ),
        bracketData.knockout_result
      );
      setSelectedRound(getDefaultRound(actual));
      setAutoAdvanced(true);
    }
  }, [bracketData, autoAdvanced]);

  function changeRound(round: RoundKey) {
    setSelectedRound(round);
    setRoundKey((k) => k + 1);
    // Scroll the tab into view
    requestAnimationFrame(() => {
      const tabEl = tabsRef.current?.querySelector(`[data-round="${round}"]`);
      tabEl?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
  }

  // Derived data
  const groupPicksForField = bracketData?.group_results.map((r) => ({ ...r, locked: true })) ?? [];
  const thirdsSlots: Record<number, string> = bracketData?.thirds_result
    ? Object.fromEntries(Object.entries(bracketData.thirds_result.bracket_slots).map(([k, v]) => [parseInt(k), v]))
    : {};
  const r32Field = bracketData
    ? buildR32Field(
        groupPicksForField,
        bracketData.thirds_result ? { teams: bracketData.thirds_result.qualified_thirds } : null,
        thirdsSlots
      )
    : Array(32).fill("TBD");

  const actualPicks: KnockoutPicks = bracketData?.knockout_result
    ? deriveActualPicks(r32Field, bracketData.knockout_result)
    : EMPTY_PICKS;

  const hasUserPicks = userPicks && (
    userPicks.R16.some(Boolean) || userPicks.QF.some(Boolean) ||
    userPicks.SF.some(Boolean) || userPicks.Final.some(Boolean) || !!userPicks.Champion
  );

  // Total knockout points
  const knockoutPts = userPicks && bracketData?.knockout_result
    ? (() => {
        const r = bracketData.knockout_result;
        const up = userPicks;
        const r32Set = new Set(r.R32Winners), r16Set = new Set(r.R16Winners);
        const qfSet = new Set(r.QFWinners), sfSet = new Set(r.SFWinners);
        const r32 = up.R16.filter((t) => t && r32Set.has(t)).length * 2;
        const r16 = up.QF.filter((t) => t && r16Set.has(t)).length * 4;
        const qf  = up.SF.filter((t) => t && qfSet.has(t)).length * 6;
        const sf  = up.Final.filter((t) => t && sfSet.has(t)).length * 10;
        const champ = r.champion && up.Champion === r.champion ? 20 : 0;
        const finalist = r.champion && up.Final.includes(r.champion) && up.Champion !== r.champion ? 15 : 0;
        return r32 + r16 + qf + sf + champ + finalist;
      })()
    : null;

  const currentRoundData = ROUNDS.find((r) => r.key === selectedRound)!;
  const matches = getMatchesForRound(selectedRound, r32Field, actualPicks, showPicks && hasUserPicks ? userPicks : null);
  const resultCount = roundResultCount(selectedRound, actualPicks);
  const isFinal = selectedRound === "Final";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

      {/* ── Header ── */}
      <div className="mb-5 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-4xl tracking-widest text-away-gold mb-1">Knockout Bracket</h1>
          <p className="text-away-cream/60 text-sm">
            Updated live as results come in.{" "}
            {lastUpdated && <span>Last refreshed: {lastUpdated.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {user && hasUserPicks && (
            <button
              onClick={() => setShowPicks((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                showPicks
                  ? "bg-away-gold/20 border-away-gold text-away-gold"
                  : "bg-away-green hover:bg-away-moss text-away-cream/80 border-away-moss"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {showPicks ? "Hide My Picks" : "Show My Picks"}
              {showPicks && knockoutPts !== null && knockoutPts > 0 && (
                <span className="ml-1 bg-away-gold text-away-green font-bold px-1.5 py-0.5 rounded text-xs">
                  {knockoutPts} pts
                </span>
              )}
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-away-green hover:bg-away-moss text-away-cream/80 border border-away-moss px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-away-gold animate-pulse text-lg font-semibold">Loading bracket...</div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── Round tab bar ── */}
          <div
            ref={tabsRef}
            className="flex gap-1.5 overflow-x-auto pb-2 mb-5 no-scrollbar"
            style={{ scrollbarWidth: "none" }}
          >
            {ROUNDS.map((round) => {
              const count = roundResultCount(round.key, actualPicks);
              const total = round.count;
              const isActive = selectedRound === round.key;
              const hasResults = count > 0;
              return (
                <button
                  key={round.key}
                  data-round={round.key}
                  onClick={() => changeRound(round.key)}
                  className={`shrink-0 flex flex-col items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    isActive
                      ? "bg-away-gold/20 border-away-gold text-away-gold"
                      : hasResults
                      ? "bg-away-green border-away-moss text-away-cream/70 hover:border-away-gold/50 hover:text-away-cream"
                      : "bg-away-green border-away-moss/60 text-away-cream/40 hover:text-away-cream/60"
                  }`}
                >
                  <span>{round.shortLabel}</span>
                  <span className={`text-[10px] font-normal mt-0.5 ${isActive ? "text-away-gold/60" : "text-away-cream/30"}`}>
                    {hasResults ? `${count}/${total}` : `${total} matches`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Round label + summary ── */}
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg tracking-wider text-away-cream/80">
                {currentRoundData.label}
              </h2>
              {currentRoundData.pts > 0 && (
                <p className="text-away-cream/40 text-xs">{currentRoundData.pts} pts per correct pick</p>
              )}
            </div>
            {resultCount === 0 && (
              <span className="text-away-cream/30 text-xs border border-away-moss/50 rounded px-2 py-1">No results yet</span>
            )}
          </div>

          {showPicks && hasUserPicks && resultCount > 0 && (
            <RoundSummary matches={matches} pts={currentRoundData.pts} round={selectedRound} />
          )}

          {/* ── Match grid (slides in on round change) ── */}
          <div
            key={`${selectedRound}-${roundKey}`}
            style={{ animation: "bracketSlideIn 0.18s ease-out" }}
          >
            {isFinal ? (
              <FinalCard match={matches[0]} showPicks={showPicks && !!hasUserPicks} />
            ) : (
              <div className={`grid gap-3 ${
                matches.length > 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 max-w-md mx-auto sm:max-w-none"
              }`}>
                {matches.map((match, i) => (
                  <MatchCard
                    key={i}
                    match={match}
                    matchNum={i + 1}
                    showPicks={showPicks && !!hasUserPicks}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Round navigation arrows ── */}
          <div className="flex items-center justify-between mt-6">
            {(() => {
              const idx = ROUNDS.findIndex((r) => r.key === selectedRound);
              const prev = idx > 0 ? ROUNDS[idx - 1] : null;
              const next = idx < ROUNDS.length - 1 ? ROUNDS[idx + 1] : null;
              return (
                <>
                  {prev ? (
                    <button
                      onClick={() => changeRound(prev.key)}
                      className="flex items-center gap-1.5 text-away-cream/50 hover:text-away-cream text-sm transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      {prev.shortLabel}
                    </button>
                  ) : <div />}
                  {next ? (
                    <button
                      onClick={() => changeRound(next.key)}
                      className="flex items-center gap-1.5 text-away-cream/50 hover:text-away-cream text-sm transition-colors"
                    >
                      {next.shortLabel}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ) : <div />}
                </>
              );
            })()}
          </div>

          {/* ── Nudge for logged-out users ── */}
          {!user && (
            <div className="mt-6 bg-away-green border border-away-moss rounded-xl px-4 py-4 text-center">
              <p className="text-away-cream/50 text-sm">
                <a href="/register" className="text-away-gold hover:text-away-cream underline">Sign in</a>{" "}
                to see how your picks compare against the real bracket.
              </p>
            </div>
          )}
        </>
      )}

      {/* Slide-in keyframe — injected once */}
      <style>{`
        @keyframes bracketSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
