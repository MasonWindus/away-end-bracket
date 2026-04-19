import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLeaderboard } from "../lib/api";
import type { LeaderboardEntry } from "../types";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getLeaderboard();
      setEntries(data);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = entries.filter((e) =>
    e.display_name.toLowerCase().includes(search.toLowerCase())
  );

  function rankBadge(rank: number) {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">Leaderboard</h1>
        <p className="text-gray-400 text-sm">
          Updated after each match day.{" "}
          {lastUpdated && (
            <span>Last refreshed: {lastUpdated.toLocaleTimeString()}</span>
          )}
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 text-sm"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
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

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-emerald-400 animate-pulse text-lg">Loading leaderboard...</div>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && entries.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🏆</div>
          <h3 className="text-xl font-bold text-white mb-2">No picks yet!</h3>
          <p className="text-gray-400 text-sm mb-6">
            Be the first to fill out your bracket.
          </p>
          <Link
            to="/picks"
            className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-lg transition-colors"
          >
            Fill Out My Bracket
          </Link>
        </div>
      )}

      {/* No results from search */}
      {!loading && !error && entries.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">No contestants found matching "{search}"</p>
          <button
            onClick={() => setSearch("")}
            className="mt-3 text-emerald-400 hover:text-emerald-300 text-sm underline"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && filtered.length > 0 && (
        <>
          {/* Score key */}
          <div className="flex flex-wrap gap-4 mb-4 text-xs text-gray-500">
            <span>GS = Group Stage Points</span>
            <span>KO = Knockout Points</span>
            <span>Total = GS + KO</span>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-800 border-b border-gray-700">
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-16">
                      Rank
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      GS Pts
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      KO Pts
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-20">
                      Bracket
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filtered.map((entry, idx) => {
                    const badge = rankBadge(entry.rank);
                    return (
                      <tr
                        key={entry.userId}
                        className={`transition-colors hover:bg-gray-800/50 ${
                          idx < 3 ? "bg-gray-800/20" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {badge ? (
                              <span className="text-lg">{badge}</span>
                            ) : (
                              <span className="text-gray-400 font-bold text-sm w-6 text-center">
                                {entry.rank}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-white font-medium text-sm">{entry.display_name}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-gray-300 text-sm tabular-nums">
                            {entry.group_stage_score}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-gray-300 text-sm tabular-nums">
                            {entry.knockout_score}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-emerald-400 font-bold text-sm tabular-nums">
                            {entry.total_score}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            to={`/bracket/${entry.userId}`}
                            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 underline transition-colors"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-gray-500 text-xs mt-3 text-center">
            {filtered.length} contestant{filtered.length !== 1 ? "s" : ""}{" "}
            {search ? `matching "${search}"` : "total"}
          </p>
        </>
      )}
    </div>
  );
}
