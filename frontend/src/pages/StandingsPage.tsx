import React, { useEffect, useRef, useState } from "react";
import { getStandings } from "../lib/api";
import { GROUP_CODES, TEAM_NAMES } from "../data/teams";
import TeamFlag from "../components/TeamFlag";
import type { LiveGroupStandings } from "../types";

const POLL_INTERVAL_MS = 15000;

export default function StandingsPage() {
  const [groups, setGroups] = useState<LiveGroupStandings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    try {
      const data = await getStandings();
      setGroups(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load standings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const byCode = new Map(groups.map((g) => [g.group_code, g]));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-4xl tracking-widest text-away-gold mb-1">Live Standings</h1>
          <p className="text-away-cream/60 text-sm">
            Calculated automatically from entered match results.{" "}
            {lastUpdated && <span>Last refreshed: {lastUpdated.toLocaleTimeString()}</span>}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-away-green hover:bg-away-moss text-away-cream/80 border border-away-moss px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
        >
          <svg
            className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-away-gold animate-pulse text-lg font-semibold">Loading standings...</div>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {GROUP_CODES.map((code) => {
            const group = byCode.get(code);
            const table = group?.table ?? [];
            const matches = group?.matches ?? [];
            return (
              <div key={code} className="bg-away-green border border-away-moss rounded-xl overflow-hidden">
                <div className="bg-away-moss px-4 py-2.5 flex items-center justify-between">
                  <span className="font-display text-away-gold tracking-widest text-sm">GROUP {code}</span>
                  <span className="text-away-cream/40 text-xs">
                    {matches.length} match{matches.length !== 1 ? "es" : ""} played
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-away-moss/50 text-away-cream/50 text-xs uppercase tracking-wider">
                        <th className="text-left px-3 py-2">Team</th>
                        <th className="text-right px-2 py-2">P</th>
                        <th className="text-right px-2 py-2">W</th>
                        <th className="text-right px-2 py-2">D</th>
                        <th className="text-right px-2 py-2">L</th>
                        <th className="text-right px-2 py-2">GD</th>
                        <th className="text-right px-3 py-2 text-away-gold">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-away-moss/30">
                      {table.map((row, i) => (
                        <tr key={row.team} className={i < 2 ? "bg-away-moss/10" : ""}>
                          <td className="px-3 py-2 flex items-center gap-2">
                            <TeamFlag code={row.team} />
                            <span className="text-away-cream font-medium">
                              {TEAM_NAMES[row.team] ?? row.team}
                            </span>
                          </td>
                          <td className="text-right px-2 py-2 text-away-cream/70 tabular-nums">{row.played}</td>
                          <td className="text-right px-2 py-2 text-away-cream/70 tabular-nums">{row.won}</td>
                          <td className="text-right px-2 py-2 text-away-cream/70 tabular-nums">{row.drawn}</td>
                          <td className="text-right px-2 py-2 text-away-cream/70 tabular-nums">{row.lost}</td>
                          <td className="text-right px-2 py-2 text-away-cream/70 tabular-nums">
                            {row.gd > 0 ? `+${row.gd}` : row.gd}
                          </td>
                          <td className="text-right px-3 py-2 text-away-gold font-bold tabular-nums">
                            {row.points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
