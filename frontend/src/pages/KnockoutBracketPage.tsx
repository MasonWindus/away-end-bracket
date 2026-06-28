import React, { useEffect, useRef, useState } from "react";
import { getKnockoutBracket, getKnockoutPicks } from "../lib/api";
import { buildR32Field } from "../lib/bracket";
import { TEAM_NAMES } from "../data/teams";
import TeamFlag from "../components/TeamFlag";
import BracketView from "../components/BracketView";
import { useAuth } from "../lib/auth";
import type { KnockoutResult, KnockoutPicks, GroupResult, ThirdsResult } from "../types";

const POLL_INTERVAL_MS = 30000;

// Map actual results to the slot-ordered KnockoutPicks format used by BracketView.
// Traverses the bracket tree so ordering of the admin-entered winner arrays doesn't matter.
function deriveActualPicks(r32Field: string[], result: KnockoutResult): KnockoutPicks {
  const r32WinnerSet = new Set(result.R32Winners);
  const R16 = Array.from({ length: 16 }, (_, i) => {
    const a = r32Field[i * 2] || "";
    const b = r32Field[i * 2 + 1] || "";
    if (a && r32WinnerSet.has(a)) return a;
    if (b && r32WinnerSet.has(b)) return b;
    return "";
  });

  const r16WinnerSet = new Set(result.R16Winners);
  const QF = Array.from({ length: 8 }, (_, i) => {
    const a = R16[i * 2] || "";
    const b = R16[i * 2 + 1] || "";
    if (a && r16WinnerSet.has(a)) return a;
    if (b && r16WinnerSet.has(b)) return b;
    return "";
  });

  const qfWinnerSet = new Set(result.QFWinners);
  const SF = Array.from({ length: 4 }, (_, i) => {
    const a = QF[i * 2] || "";
    const b = QF[i * 2 + 1] || "";
    if (a && qfWinnerSet.has(a)) return a;
    if (b && qfWinnerSet.has(b)) return b;
    return "";
  });

  const sfWinnerSet = new Set(result.SFWinners);
  const Final = Array.from({ length: 2 }, (_, i) => {
    const a = SF[i * 2] || "";
    const b = SF[i * 2 + 1] || "";
    if (a && sfWinnerSet.has(a)) return a;
    if (b && sfWinnerSet.has(b)) return b;
    return "";
  });

  return { R16, QF, SF, Final, Champion: result.champion || "", locked: true };
}

type PickStatus = "correct" | "wrong" | "pending";

function classifyPick(userPick: string, actualWinner: string): PickStatus {
  if (!actualWinner) return "pending";
  if (!userPick) return "pending";
  return userPick === actualWinner ? "correct" : "wrong";
}

function PickPill({ team, status }: { team: string; status: PickStatus }) {
  const name = TEAM_NAMES[team] || team;
  const base = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border";
  const styles: Record<PickStatus, string> = {
    correct: `${base} bg-emerald-900/30 border-emerald-600/50 text-emerald-300`,
    wrong:   `${base} bg-red-900/20 border-red-700/40 text-red-400 line-through`,
    pending: `${base} bg-away-green border-away-moss text-away-cream/50`,
  };
  return (
    <span className={styles[status]} title={name}>
      {status === "correct" && (
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {status === "wrong" && (
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <TeamFlag code={team} />
      <span>{name}</span>
    </span>
  );
}

interface RoundComparisonProps {
  label: string;
  pts: number;
  userPickSlots: string[];
  actualWinnerSlots: string[];
}

function RoundComparison({ label, pts, userPickSlots, actualWinnerSlots }: RoundComparisonProps) {
  const statuses = userPickSlots.map((pick, i) => classifyPick(pick, actualWinnerSlots[i]));
  const correct = statuses.filter((s) => s === "correct").length;
  const played = statuses.filter((s) => s !== "pending").length;
  const earned = correct * pts;

  const pickedTeams = userPickSlots
    .map((pick, i) => ({ pick, status: statuses[i] }))
    .filter(({ pick }) => pick && pick !== "TBD");

  if (pickedTeams.length === 0) {
    return (
      <div className="bg-away-green border border-away-moss rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-display text-sm tracking-wider text-away-gold uppercase">{label}</span>
          <span className="text-away-cream/30 text-xs">{pts} pts each · not picked</span>
        </div>
        <p className="text-away-cream/30 text-sm italic">No picks submitted</p>
      </div>
    );
  }

  return (
    <div className="bg-away-green border border-away-moss rounded-xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <span className="font-display text-sm tracking-wider text-away-gold uppercase">{label}</span>
        <div className="flex items-center gap-2 text-xs">
          {played > 0 && (
            <span className="text-away-cream/50">
              {correct}/{played} correct
            </span>
          )}
          {earned > 0 && (
            <span className="bg-away-gold/20 border border-away-gold/40 text-away-gold px-2 py-0.5 rounded font-bold">
              +{earned} pts
            </span>
          )}
          <span className="text-away-cream/30">{pts} pts each</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {pickedTeams.map(({ pick, status }) => (
          <PickPill key={pick} team={pick} status={status} />
        ))}
      </div>
    </div>
  );
}

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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      getKnockoutPicks()
        .then((p) => setUserPicks(p))
        .catch(() => setUserPicks(null));
    } else {
      setUserPicks(null);
    }
  }, [user]);

  // Build the R32 field from actual group + thirds results.
  // GroupResult is structurally compatible with what buildR32Field needs; add locked to satisfy the type.
  const groupPicksForField = bracketData?.group_results.map((r) => ({ ...r, locked: true })) ?? [];
  const thirdsSlots: Record<number, string> = bracketData?.thirds_result
    ? Object.fromEntries(
        Object.entries(bracketData.thirds_result.bracket_slots).map(([k, v]) => [parseInt(k), v])
      )
    : {};

  const r32Field = bracketData
    ? buildR32Field(
        groupPicksForField,
        bracketData.thirds_result ? { teams: bracketData.thirds_result.qualified_thirds } : null,
        thirdsSlots
      )
    : Array(32).fill("TBD");

  // Derive slot-ordered picks from actual results for BracketView display
  const actualPicks: KnockoutPicks =
    bracketData?.knockout_result
      ? deriveActualPicks(r32Field, bracketData.knockout_result)
      : { R16: Array(16).fill(""), QF: Array(8).fill(""), SF: Array(4).fill(""), Final: Array(2).fill(""), Champion: "", locked: true };

  const hasUserPicks = userPicks && (
    userPicks.R16.some(Boolean) ||
    userPicks.QF.some(Boolean) ||
    userPicks.SF.some(Boolean) ||
    userPicks.Final.some(Boolean) ||
    !!userPicks.Champion
  );

  // Compute total points from user picks vs actual results
  const knockoutPoints = userPicks && bracketData?.knockout_result
    ? (() => {
        const r = bracketData.knockout_result;
        const up = userPicks;
        const r32Set = new Set(r.R32Winners);
        const r16Set = new Set(r.R16Winners);
        const qfSet = new Set(r.QFWinners);
        const sfSet = new Set(r.SFWinners);
        const r32Pts = up.R16.filter((t) => t && r32Set.has(t)).length * 2;
        const r16Pts = up.QF.filter((t) => t && r16Set.has(t)).length * 4;
        const qfPts = up.SF.filter((t) => t && qfSet.has(t)).length * 6;
        const sfPts = up.Final.filter((t) => t && sfSet.has(t)).length * 10;
        const championCorrect = r.champion && up.Champion === r.champion;
        const finalistCorrect = r.champion && up.Final.includes(r.champion) && up.Champion !== r.champion;
        const championPts = championCorrect ? 20 : 0;
        const finalistPts = finalistCorrect ? 15 : 0;
        return r32Pts + r16Pts + qfPts + sfPts + finalistPts + championPts;
      })()
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
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
              {showPicks && knockoutPoints !== null && knockoutPoints > 0 && (
                <span className="ml-1 bg-away-gold text-away-green font-bold px-1.5 py-0.5 rounded text-xs">
                  {knockoutPoints} pts
                </span>
              )}
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-away-green hover:bg-away-moss text-away-cream/80 border border-away-moss px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            <svg
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-away-gold animate-pulse text-lg font-semibold">Loading bracket...</div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* No results yet state */}
          {!bracketData?.knockout_result && !bracketData?.group_results.length && (
            <div className="bg-away-green border border-away-moss rounded-xl px-6 py-10 text-center mb-6">
              <svg className="w-12 h-12 text-away-cream/20 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-away-cream/40 font-medium">Knockout bracket matchups will appear here once the group stage is complete.</p>
            </div>
          )}

          {/* Bracket visual */}
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <BracketView
                r32Field={r32Field}
                thirdsSlots={thirdsSlots}
                picks={actualPicks}
                onPicksChange={() => {}}
                locked={true}
              />
            </div>
          </div>

          {/* My Picks comparison */}
          {showPicks && userPicks && hasUserPicks && bracketData?.knockout_result && (
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-display text-xl tracking-widest text-away-gold">My Picks</h2>
                {knockoutPoints !== null && (
                  <span className="bg-away-gold/20 border border-away-gold/50 text-away-gold px-3 py-1 rounded-lg text-sm font-bold">
                    {knockoutPoints} knockout pts
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <RoundComparison
                  label="Round of 32"
                  pts={2}
                  userPickSlots={userPicks.R16}
                  actualWinnerSlots={actualPicks.R16}
                />
                <RoundComparison
                  label="Round of 16"
                  pts={4}
                  userPickSlots={userPicks.QF}
                  actualWinnerSlots={actualPicks.QF}
                />
                <RoundComparison
                  label="Quarterfinals"
                  pts={6}
                  userPickSlots={userPicks.SF}
                  actualWinnerSlots={actualPicks.SF}
                />
                <RoundComparison
                  label="Semifinals"
                  pts={10}
                  userPickSlots={userPicks.Final}
                  actualWinnerSlots={actualPicks.Final}
                />

                {/* Final & Champion */}
                <div className="bg-away-green border border-away-moss rounded-xl p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <span className="font-display text-sm tracking-wider text-away-gold uppercase">Final & Champion</span>
                  </div>
                  <div className="space-y-2">
                    {/* Finalist pick (15 pts) */}
                    {(() => {
                      const champion = bracketData.knockout_result.champion;
                      const sfWinners = bracketData.knockout_result.SFWinners;
                      const nonChampFinalist = sfWinners.find((t) => t !== champion);
                      const userFinalist = userPicks.Final.find((t) => t !== userPicks.Champion);
                      const finalistStatus = !nonChampFinalist
                        ? "pending"
                        : userFinalist === nonChampFinalist
                        ? "correct"
                        : "wrong";
                      return (
                        <div className="flex items-center justify-between">
                          <span className="text-away-cream/50 text-xs">Runner-up (15 pts)</span>
                          <div className="flex items-center gap-2">
                            {userFinalist ? (
                              <PickPill team={userFinalist} status={finalistStatus} />
                            ) : (
                              <span className="text-away-cream/30 text-xs italic">not picked</span>
                            )}
                            {nonChampFinalist && finalistStatus === "wrong" && (
                              <span className="text-away-cream/30 text-xs">
                                actual: <span className="text-away-cream/60">{TEAM_NAMES[nonChampFinalist] || nonChampFinalist}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    {/* Champion pick (20 pts) */}
                    {(() => {
                      const actual = bracketData.knockout_result.champion;
                      const picked = userPicks.Champion;
                      const status = classifyPick(picked, actual);
                      return (
                        <div className="flex items-center justify-between">
                          <span className="text-away-cream/50 text-xs">Champion (20 pts)</span>
                          <div className="flex items-center gap-2">
                            {picked ? (
                              <PickPill team={picked} status={status} />
                            ) : (
                              <span className="text-away-cream/30 text-xs italic">not picked</span>
                            )}
                            {actual && status === "wrong" && (
                              <span className="text-away-cream/30 text-xs">
                                actual: <span className="text-away-cream/60">{TEAM_NAMES[actual] || actual}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nudge for logged-out users */}
          {!user && (
            <div className="mt-6 bg-away-green border border-away-moss rounded-xl px-4 py-4 text-center">
              <p className="text-away-cream/50 text-sm">
                <a href="/register" className="text-away-gold hover:text-away-cream underline">Sign in</a> to see how your picks compare against the real bracket.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
