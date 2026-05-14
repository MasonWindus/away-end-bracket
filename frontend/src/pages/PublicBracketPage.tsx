import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getUserBracket } from "../lib/api";
import { GROUPS, GROUP_CODES, TEAM_NAMES } from "../data/teams";
import TeamFlag from "../components/TeamFlag";
import type { PublicBracket, GroupPick, KnockoutPicks } from "../types";
import BracketView from "../components/BracketView";

type KnockoutView = "bracket" | "pills";

function buildR32Field(groupPicks: GroupPick[], thirdsPick: { teams: string[] } | null): string[] {
  const pickMap: Record<string, GroupPick> = {};
  for (const p of groupPicks) pickMap[p.group_code] = p;

  function winner(g: string) { return pickMap[g]?.first_place || "TBD"; }
  function runnerUp(g: string) { return pickMap[g]?.second_place || "TBD"; }
  function thirdSlot(slot: number) { return thirdsPick?.teams[slot - 1] || "TBD"; }

  return [
    winner("A"),    thirdSlot(1),
    runnerUp("B"),  runnerUp("A"),
    winner("B"),    thirdSlot(2),
    winner("C"),    runnerUp("C"),
    winner("D"),    thirdSlot(3),
    runnerUp("E"),  runnerUp("D"),
    winner("E"),    thirdSlot(4),
    winner("F"),    runnerUp("F"),
    winner("G"),    thirdSlot(5),
    runnerUp("H"),  runnerUp("G"),
    winner("H"),    thirdSlot(6),
    winner("I"),    runnerUp("I"),
    winner("J"),    thirdSlot(7),
    runnerUp("K"),  runnerUp("J"),
    winner("K"),    thirdSlot(8),
    winner("L"),    runnerUp("L"),
  ];
}

function emptyKnockoutPicks(): KnockoutPicks {
  return { R16: Array(16).fill(""), QF: Array(8).fill(""), SF: Array(4).fill(""), Final: Array(2).fill(""), Champion: "", locked: true };
}

function GroupPickReadOnly({ pick }: { pick: GroupPick }) {
  const teams = GROUPS[pick.group_code] || [];
  const order = [pick.first_place, pick.second_place, pick.third_place, pick.fourth_place];
  const labels = ["1st", "2nd", "3rd", "4th"];
  const filled = order.some(Boolean);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      <h3 className="text-emerald-400 font-bold text-sm uppercase tracking-wider mb-3">
        Group {pick.group_code}
      </h3>
      {filled ? (
        <ol className="space-y-1.5">
          {order.map((team, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-gray-500 text-xs w-7 shrink-0">{labels[i]}</span>
              <span className="text-sm text-gray-200 flex items-center gap-1.5">
                {team ? <><TeamFlag code={team} /> {TEAM_NAMES[team] || team}</> : <span className="text-gray-600 italic">—</span>}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-gray-500 text-sm italic">No pick submitted</p>
      )}
    </div>
  );
}

export default function PublicBracketPage() {
  const { userId } = useParams<{ userId: string }>();
  const [bracket, setBracket] = useState<PublicBracket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [knockoutView, setKnockoutView] = useState<KnockoutView>("bracket");

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getUserBracket(userId)
      .then(setBracket)
      .catch((err: Error) => setError(err.message || "User not found"))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-emerald-400 animate-pulse text-lg">Loading bracket...</div>
      </div>
    );
  }

  if (error || !bracket) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400 text-lg mb-4">{error || "Bracket not found"}</p>
        <Link to="/leaderboard" className="text-emerald-400 hover:text-emerald-300 underline">
          ← Back to Leaderboard
        </Link>
      </div>
    );
  }

  const pickMap: Record<string, GroupPick> = {};
  for (const p of bracket.group_picks) pickMap[p.group_code] = p;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <Link to="/leaderboard" className="text-emerald-400 hover:text-emerald-300 text-sm mb-2 inline-block">
            ← Leaderboard
          </Link>
          <h1 className="text-3xl font-bold text-white">{bracket.display_name}'s Bracket</h1>
          <p className="text-gray-400 mt-1">The Away End — World Cup 2026</p>
        </div>
      </div>

      {/* Group Picks */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-white mb-4">Group Stage Picks</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {GROUP_CODES.map((code) => {
            const pick = pickMap[code] || {
              group_code: code,
              first_place: "", second_place: "", third_place: "", fourth_place: "", locked: false,
            };
            return <GroupPickReadOnly key={code} pick={pick as GroupPick} />;
          })}
        </div>
      </section>

      {/* Thirds Picks */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-white mb-4">Third-Place Picks (8 of 12)</h2>
        {bracket.thirds_pick && bracket.thirds_pick.teams.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {bracket.thirds_pick.teams.map((code) => (
              <span
                key={code}
                className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-full text-sm text-gray-200"
              >
                {TEAM_NAMES[code] || code}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 italic">No thirds picks submitted</p>
        )}
      </section>

      {/* Knockout Picks */}
      <section>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-xl font-bold text-white">Knockout Bracket Picks</h2>
          {bracket.knockout_picks && (
            <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
              <button
                onClick={() => setKnockoutView("bracket")}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  knockoutView === "bracket"
                    ? "bg-emerald-700 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Bracket
              </button>
              <button
                onClick={() => setKnockoutView("pills")}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  knockoutView === "pills"
                    ? "bg-emerald-700 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                By Round
              </button>
            </div>
          )}
        </div>

        {bracket.knockout_picks ? (
          knockoutView === "bracket" ? (
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <BracketView
                  r32Field={buildR32Field(bracket.group_picks, bracket.thirds_pick)}
                  thirdsSlots={{}}
                  picks={{ ...emptyKnockoutPicks(), ...bracket.knockout_picks, locked: true }}
                  onPicksChange={() => {}}
                  locked={true}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {(
                [
                  ["R16", "Predicted R16 (16 teams)", bracket.knockout_picks.R16],
                  ["QF", "Predicted Quarterfinals (8 teams)", bracket.knockout_picks.QF],
                  ["SF", "Predicted Semifinals (4 teams)", bracket.knockout_picks.SF],
                  ["Final", "Predicted Finalists (2 teams)", bracket.knockout_picks.Final],
                ] as Array<[string, string, string[]]>
              ).map(([key, label, teams]) => (
                <div key={key}>
                  <h3 className="text-gray-400 text-sm font-medium mb-2">{label}</h3>
                  {teams && teams.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {teams.map((code) => (
                        <span
                          key={code}
                          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-full text-sm text-gray-200"
                        >
                          {TEAM_NAMES[code] || code}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 italic text-sm">Not set</p>
                  )}
                </div>
              ))}

              <div>
                <h3 className="text-gray-400 text-sm font-medium mb-2">Predicted Champion</h3>
                {bracket.knockout_picks.Champion ? (
                  <span className="px-4 py-2 bg-emerald-700/30 border border-emerald-600 rounded-full text-emerald-300 font-bold text-lg">
                    🏆 {TEAM_NAMES[bracket.knockout_picks.Champion] || bracket.knockout_picks.Champion}
                  </span>
                ) : (
                  <p className="text-gray-600 italic text-sm">Not set</p>
                )}
              </div>
            </div>
          )
        ) : (
          <p className="text-gray-500 italic">No knockout picks submitted</p>
        )}
      </section>
    </div>
  );
}
