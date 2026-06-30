import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { getUserBracket, getStandings, getKnockoutBracket } from "../lib/api";
import { buildR32Field, deriveActualPicks, buildRoundStatusMap, type MatchTeamStatus } from "../lib/bracket";
import { GROUP_CODES, TEAM_NAMES } from "../data/teams";
import TeamFlag from "../components/TeamFlag";
import type {
  GroupCode,
  GroupPick,
  LiveGroupStandings,
  PublicBracket,
  ThirdsResult,
  KnockoutResult,
  GroupResult,
} from "../types";

const POSITION_LABELS = ["1st", "2nd", "3rd", "4th"] as const;
const POSITION_KEYS = ["first_place", "second_place", "third_place", "fourth_place"] as const;

interface GroupBreakdown {
  code: GroupCode;
  pick: GroupPick;
  actualOrder: string[] | null;
  isOfficial: boolean;
  points: number | null;
}

function emptyGroupPick(code: GroupCode): GroupPick {
  return { group_code: code, first_place: "", second_place: "", third_place: "", fourth_place: "", locked: false };
}

function computeGroupBreakdown(
  code: GroupCode,
  pick: GroupPick | undefined,
  official: GroupResult | undefined,
  live: LiveGroupStandings | undefined
): GroupBreakdown {
  const usedPick = pick ?? emptyGroupPick(code);

  if (official) {
    const actualOrder = [official.first_place, official.second_place, official.third_place, official.fourth_place];
    const points = POSITION_KEYS.reduce((sum, key, i) => sum + (usedPick[key] === actualOrder[i] ? 1 : 0), 0);
    return { code, pick: usedPick, actualOrder, isOfficial: true, points };
  }

  const table = live?.table ?? [];
  if (table.length === 4 && table.every((t) => t.played > 0)) {
    const actualOrder = table.map((t) => t.team);
    const points = POSITION_KEYS.reduce((sum, key, i) => sum + (usedPick[key] === actualOrder[i] ? 1 : 0), 0);
    return { code, pick: usedPick, actualOrder, isOfficial: false, points };
  }

  return { code, pick: usedPick, actualOrder: null, isOfficial: false, points: null };
}

function GroupBreakdownCard({ breakdown }: { breakdown: GroupBreakdown }) {
  const { code, pick, actualOrder, isOfficial, points } = breakdown;

  return (
    <div className="bg-away-green border border-away-moss rounded-xl overflow-hidden">
      <div className="bg-away-moss px-4 py-2 flex items-center justify-between">
        <span className="font-display text-away-gold tracking-widest text-sm">GROUP {code}</span>
        {points !== null ? (
          <span className={`text-xs font-bold ${points > 0 ? "text-away-gold" : "text-away-cream/40"}`}>
            {points}/4 pts {!isOfficial && <span className="text-away-cream/30 font-normal">(live)</span>}
          </span>
        ) : (
          <span className="text-away-cream/30 text-xs">Pending</span>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        {POSITION_LABELS.map((label, i) => {
          const pickedTeam = pick[POSITION_KEYS[i]];
          const actualTeam = actualOrder ? actualOrder[i] : null;
          const correct = !!actualTeam && pickedTeam === actualTeam;
          return (
            <div key={label} className="flex items-center justify-between text-sm gap-2">
              <span className="text-away-cream/40 w-8 shrink-0">{label}</span>
              <span className="flex-1 flex items-center gap-1.5 text-away-cream min-w-0 truncate">
                {pickedTeam ? (
                  <>
                    <TeamFlag code={pickedTeam} /> {TEAM_NAMES[pickedTeam] || pickedTeam}
                  </>
                ) : (
                  <span className="italic text-away-cream/30">No pick</span>
                )}
              </span>
              {actualTeam && (
                <span className={`text-xs font-bold shrink-0 ${correct ? "text-emerald-400" : "text-red-400/70"}`}>
                  {correct ? "✓" : "✗"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThirdsCard({ picks, qualified }: { picks: string[]; qualified: string[] | null }) {
  const qualifiedSet = new Set(qualified ?? []);
  const points = qualified ? picks.filter((t) => qualifiedSet.has(t)).length : null;

  return (
    <div className="bg-away-green border border-away-moss rounded-xl overflow-hidden">
      <div className="bg-away-moss px-4 py-2 flex items-center justify-between">
        <span className="font-display text-away-gold tracking-widest text-sm">THIRD-PLACE QUALIFIERS</span>
        {points !== null ? (
          <span className={`text-xs font-bold ${points > 0 ? "text-away-gold" : "text-away-cream/40"}`}>
            {points}/8 pts
          </span>
        ) : (
          <span className="text-away-cream/30 text-xs">Pending</span>
        )}
      </div>
      <div className="p-3">
        {picks.length === 0 ? (
          <p className="text-away-cream/30 italic text-sm">No thirds pick submitted</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {picks.map((team) => {
              const correct = qualified ? qualifiedSet.has(team) : null;
              return (
                <span
                  key={team}
                  className={`px-3 py-1.5 rounded-full text-sm border flex items-center gap-1.5 ${
                    correct === null
                      ? "bg-away-moss/40 border-away-moss text-away-cream/70"
                      : correct
                      ? "bg-emerald-900/30 border-emerald-600/50 text-emerald-300"
                      : "bg-red-900/15 border-red-700/30 text-red-400/70"
                  }`}
                >
                  <TeamFlag code={team} /> {TEAM_NAMES[team] || team}
                  {correct !== null && <span className="text-xs">{correct ? "✓" : "✗"}</span>}
                </span>
              );
            })}
          </div>
        )}
        <p className="text-away-cream/40 text-xs mt-2">1 pt per correctly picked qualifying third-place team.</p>
      </div>
    </div>
  );
}

function KnockoutRoundCard({
  title,
  ptsEach,
  picks,
  actualWinners,
  statusMap,
}: {
  title: string;
  ptsEach: number;
  picks: string[];
  actualWinners: string[] | null;
  statusMap: Map<string, MatchTeamStatus>;
}) {
  const filledPicks = picks.filter(Boolean);
  const points = actualWinners
    ? filledPicks.filter((t) => actualWinners.includes(t)).length * ptsEach
    : null;

  return (
    <div className="bg-away-green border border-away-moss rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div>
          <h3 className="font-display text-away-gold tracking-wider text-lg">{title}</h3>
          <p className="text-away-cream/40 text-xs">{ptsEach} pts per team correctly predicted to advance</p>
        </div>
        {points !== null ? (
          <span className={`font-bold text-lg shrink-0 ${points > 0 ? "text-away-gold" : "text-away-cream/40"}`}>
            +{points} pts
          </span>
        ) : (
          <span className="text-away-cream/30 text-xs shrink-0">Pending</span>
        )}
      </div>
      {filledPicks.length === 0 ? (
        <p className="text-away-cream/30 italic text-sm">No picks submitted</p>
      ) : actualWinners === null ? (
        <p className="text-away-cream/40 italic text-sm">Awaiting official results for this round.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {filledPicks.map((team) => {
            // "won"/"lost" require knowing this team's specific match result, not just
            // absence from the round's winners list — that's equally true of a team
            // that simply hasn't played yet, which shouldn't be shown as eliminated.
            const status = statusMap.get(team) ?? "pending";
            return (
              <span
                key={team}
                className={`px-3 py-1.5 rounded-full text-sm border flex items-center gap-1.5 ${
                  status === "won"
                    ? "bg-emerald-900/30 border-emerald-600/50 text-emerald-300"
                    : status === "lost"
                    ? "bg-red-900/15 border-red-700/30 text-red-400/70"
                    : "bg-away-moss/40 border-away-moss text-away-cream/70"
                }`}
              >
                <TeamFlag code={team} /> {TEAM_NAMES[team] || team}
                {status !== "pending" && <span className="text-xs">{status === "won" ? "✓" : "✗"}</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BonusCard({
  title,
  description,
  pts,
  earned,
  pending,
  pickLabel,
}: {
  title: string;
  description: string;
  pts: number;
  earned: boolean;
  pending: boolean;
  pickLabel: string | null;
}) {
  return (
    <div className="bg-away-green border border-away-moss rounded-xl p-4">
      <div className="flex items-center justify-between mb-1 gap-2">
        <h3 className="font-display text-away-gold tracking-wider text-lg">{title}</h3>
        {pending ? (
          <span className="text-away-cream/30 text-xs shrink-0">Pending</span>
        ) : (
          <span className={`font-bold text-lg shrink-0 ${earned ? "text-away-gold" : "text-away-cream/40"}`}>
            +{earned ? pts : 0} pts
          </span>
        )}
      </div>
      <p className="text-away-cream/40 text-xs mb-2">{description}</p>
      {pickLabel ? (
        <p className="text-sm text-away-cream">
          Your pick: <span className="font-semibold">{pickLabel}</span>{" "}
          {!pending && <span className={earned ? "text-emerald-400" : "text-red-400/70"}>{earned ? "✓" : "✗"}</span>}
        </p>
      ) : (
        <p className="text-away-cream/30 italic text-sm">No pick submitted</p>
      )}
    </div>
  );
}

export default function ScoreBreakdownPage() {
  const { user } = useAuth();
  const [bracket, setBracket] = useState<PublicBracket | null>(null);
  const [standings, setStandings] = useState<LiveGroupStandings[]>([]);
  const [koData, setKoData] = useState<{
    knockout_result: KnockoutResult | null;
    group_results: GroupResult[];
    thirds_result: ThirdsResult | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([getUserBracket(user.id), getStandings(), getKnockoutBracket()])
      .then(([b, s, k]) => {
        setBracket(b);
        setStandings(s);
        setKoData(k);
      })
      .catch((err: Error) => setError(err.message || "Failed to load your score breakdown"))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-away-gold animate-pulse text-lg">Loading your score breakdown...</div>
      </div>
    );
  }

  if (error || !bracket || !koData) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400 text-lg mb-4">{error || "Could not load score breakdown"}</p>
        <Link to="/picks" className="text-away-gold hover:text-away-gold-light underline">
          ← Back to My Picks
        </Link>
      </div>
    );
  }

  const pickMap = new Map<string, GroupPick>(bracket.group_picks.map((p) => [p.group_code, p]));
  const standingsMap = new Map<string, LiveGroupStandings>(standings.map((s) => [s.group_code, s]));
  const officialGroupMap = new Map<string, GroupResult>(koData.group_results.map((r) => [r.group_code, r]));

  const groupBreakdowns: GroupBreakdown[] = GROUP_CODES.map((code) =>
    computeGroupBreakdown(code, pickMap.get(code), officialGroupMap.get(code), standingsMap.get(code))
  );
  const groupStageLivePts = groupBreakdowns.reduce((sum, g) => sum + (g.points ?? 0), 0);

  const thirdsPicks = bracket.thirds_pick?.teams ?? [];
  const qualifiedThirds = koData.thirds_result?.qualified_thirds ?? null;
  const thirdsLivePts = qualifiedThirds
    ? thirdsPicks.filter((t) => qualifiedThirds.includes(t)).length
    : 0;

  const liveGroupStageTotal = groupStageLivePts + thirdsLivePts;

  const ko = bracket.knockout_picks;
  const result = koData.knockout_result;

  // Reconstruct the real bracket pairings so we can tell "eliminated" apart from
  // "hasn't played yet" — both look the same as a flat "absent from winners list"
  // check, but only the former should render as a red/incorrect pick.
  const r32Field = buildR32Field(
    koData.group_results.map((r) => ({ ...r, locked: true })),
    koData.thirds_result ? { teams: koData.thirds_result.qualified_thirds } : null,
    koData.thirds_result
      ? Object.fromEntries(Object.entries(koData.thirds_result.bracket_slots).map(([k, v]) => [parseInt(k), v]))
      : {}
  );
  const actualPicks = result ? deriveActualPicks(r32Field, result) : null;
  const r32StatusMap = buildRoundStatusMap(r32Field, result?.R32Winners ?? []);
  const r16StatusMap = buildRoundStatusMap(actualPicks?.R16 ?? [], result?.R16Winners ?? []);
  const qfStatusMap = buildRoundStatusMap(actualPicks?.QF ?? [], result?.QFWinners ?? []);
  const sfStatusMap = buildRoundStatusMap(actualPicks?.SF ?? [], result?.SFWinners ?? []);

  const r32Actual = result && result.R32Winners.length > 0 ? result.R32Winners : null;
  const r16Actual = result && result.R16Winners.length > 0 ? result.R16Winners : null;
  const qfActual = result && result.QFWinners.length > 0 ? result.QFWinners : null;
  const sfActual = result && result.SFWinners.length > 0 ? result.SFWinners : null;

  const r32Pts = r32Actual ? (ko?.R16 ?? []).filter((t) => t && r32Actual.includes(t)).length * 2 : 0;
  const r16Pts = r16Actual ? (ko?.QF ?? []).filter((t) => t && r16Actual.includes(t)).length * 4 : 0;
  const qfPts = qfActual ? (ko?.SF ?? []).filter((t) => t && qfActual.includes(t)).length * 6 : 0;
  const sfPts = sfActual ? (ko?.Final ?? []).filter((t) => t && sfActual.includes(t)).length * 10 : 0;

  const champion = result?.champion || "";
  const sfWinners = result?.SFWinners ?? [];
  const finalistPending = !champion || sfWinners.length !== 2;
  const finalists = champion ? sfWinners.filter((t) => t !== champion) : [];
  const userFinalSet = new Set(ko?.Final ?? []);
  const finalistEarned = !finalistPending && finalists.some((t) => userFinalSet.has(t));
  const finalistPts = finalistEarned ? 15 : 0;

  const championPending = !champion;
  const championEarned = !championPending && ko?.Champion === champion;
  const championPts = championEarned ? 20 : 0;

  const liveKnockoutTotal = r32Pts + r16Pts + qfPts + sfPts + finalistPts + championPts;
  const liveGrandTotal = liveGroupStageTotal + liveKnockoutTotal;

  const official = bracket.scores;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-4xl tracking-widest text-away-gold mb-1">Score Breakdown</h1>
        <p className="text-away-cream/60 text-sm">
          Every stage of your score, calculated live so you can see exactly how points were earned.
        </p>
      </div>

      {bracket.is_late_entry && (
        <div className="mb-6 bg-orange-500/10 border border-orange-500/40 rounded-lg px-4 py-3 text-orange-300 text-sm">
          <span className="font-bold text-orange-400">Late Entry</span> — picks submitted after the tournament began
          may have missed scoring on already-completed stages.
        </div>
      )}

      {/* Totals summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-away-moss border border-away-gold/40 rounded-xl p-5">
          <p className="text-away-cream/50 text-xs uppercase tracking-widest mb-1">Official Total</p>
          <p className="font-display text-4xl text-away-gold">{official?.total_score ?? 0}</p>
          <p className="text-away-cream/40 text-xs mt-1">
            {official?.last_calculated
              ? `Last calculated ${new Date(official.last_calculated).toLocaleString()}`
              : "Not yet calculated by an admin"}
          </p>
        </div>
        <div className="bg-away-green border border-away-moss rounded-xl p-5">
          <p className="text-away-cream/50 text-xs uppercase tracking-widest mb-1">Live Total (this page)</p>
          <p className="font-display text-4xl text-away-cream">{liveGrandTotal}</p>
          <p className="text-away-cream/40 text-xs mt-1">
            Computed right now from live standings and official results. May differ from your official total until
            the next admin recalculation.
          </p>
        </div>
      </div>

      {/* Group stage */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-away-cream">Group Stage</h2>
          <span className="text-away-gold font-bold text-sm">{groupStageLivePts}/48 pts</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groupBreakdowns.map((g) => (
            <GroupBreakdownCard key={g.code} breakdown={g} />
          ))}
        </div>
      </section>

      {/* Thirds */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-away-cream">Third-Place Qualifiers</h2>
          <span className="text-away-gold font-bold text-sm">{thirdsLivePts}/8 pts</span>
        </div>
        <ThirdsCard picks={thirdsPicks} qualified={qualifiedThirds} />
      </section>

      {/* Knockout rounds */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-away-cream">Knockout Stage</h2>
          <span className="text-away-gold font-bold text-sm">{liveKnockoutTotal}/143 pts</span>
        </div>
        <div className="space-y-4">
          <KnockoutRoundCard
            title="Round of 32 → Round of 16"
            ptsEach={2}
            picks={ko?.R16 ?? []}
            actualWinners={r32Actual}
            statusMap={r32StatusMap}
          />
          <KnockoutRoundCard
            title="Round of 16 → Quarterfinals"
            ptsEach={4}
            picks={ko?.QF ?? []}
            actualWinners={r16Actual}
            statusMap={r16StatusMap}
          />
          <KnockoutRoundCard
            title="Quarterfinals → Semifinals"
            ptsEach={6}
            picks={ko?.SF ?? []}
            actualWinners={qfActual}
            statusMap={qfStatusMap}
          />
          <KnockoutRoundCard
            title="Semifinals → Final"
            ptsEach={10}
            picks={ko?.Final ?? []}
            statusMap={sfStatusMap}
            actualWinners={sfActual}
          />
          <BonusCard
            title="Runner-Up Finalist"
            description="15 pts if the non-champion finalist is one of your two Final picks."
            pts={15}
            earned={finalistEarned}
            pending={finalistPending}
            pickLabel={
              ko?.Final && ko.Final.some(Boolean)
                ? ko.Final.filter(Boolean).map((t) => TEAM_NAMES[t] || t).join(" & ")
                : null
            }
          />
          <BonusCard
            title="Champion"
            description="20 pts if your predicted champion is correct."
            pts={20}
            earned={championEarned}
            pending={championPending}
            pickLabel={ko?.Champion ? TEAM_NAMES[ko.Champion] || ko.Champion : null}
          />
        </div>
      </section>

      {/* Grand total recap */}
      <section className="bg-away-moss border border-away-gold/40 rounded-xl p-5 flex items-center justify-between">
        <span className="font-display text-away-gold tracking-widest text-lg">Live Grand Total</span>
        <span className="font-display text-3xl text-away-gold">{liveGrandTotal} pts</span>
      </section>
    </div>
  );
}
