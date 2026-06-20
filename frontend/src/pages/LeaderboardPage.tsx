import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getLeaderboard } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { LeaderboardEntry } from "../types";

const PAGE_SIZE = 50;

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [pinned, setPinned] = useState<LeaderboardEntry[]>([]);
  const [currentUserEntry, setCurrentUserEntry] = useState<LeaderboardEntry | null>(null);
  const [total, setTotal] = useState(0);
  const [totalEntrants, setTotalEntrants] = useState(0);
  const [lateEntryCount, setLateEntryCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [excludeLate, setExcludeLate] = useState(false);

  // Debounce search so we don't fire on every keystroke
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load(p: number, s: string, hideLate: boolean) {
    setLoading(true);
    setError(null);
    try {
      const data = await getLeaderboard(p, s, user?.id ?? "", hideLate);
      setEntries(data.entries);
      setPinned(data.pinned);
      setCurrentUserEntry(data.currentUserEntry ?? null);
      setTotal(data.total);
      setTotalEntrants(data.totalEntrants);
      setLateEntryCount(data.lateEntryCount);
      setTotalPages(data.totalPages);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, "", excludeLate);
    setSearch("");
    setPage(1);
  }, [user?.id]);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => load(1, value, excludeLate), 300);
  }

  function handleExcludeLateChange(value: boolean) {
    setExcludeLate(value);
    setPage(1);
    load(1, search, value);
  }

  function goToPage(p: number) {
    setPage(p);
    load(p, search, excludeLate);
  }

  const safePage = page;
  const startIdx = (safePage - 1) * PAGE_SIZE;

  function rankBadge(rank: number) {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  }

  function pageNumbers(current: number, total: number): (number | "…")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (current > 3) pages.push("…");
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
      pages.push(p);
    }
    if (current < total - 2) pages.push("…");
    pages.push(total);
    return pages;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-4xl tracking-widest text-away-gold mb-1">Leaderboard</h1>
        <p className="text-away-cream/60 text-sm">
          Updated after each match day.{" "}
          {lastUpdated && (
            <span>Last refreshed: {lastUpdated.toLocaleTimeString()}</span>
          )}
        </p>
      </div>

      {/* Provisional scores notice */}
      <div className="mb-6 bg-away-moss/40 border border-away-gold/30 rounded-lg px-4 py-3 flex gap-3 items-start">
        <svg className="w-4 h-4 text-away-gold shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-away-cream/70 text-sm leading-snug">
          <span className="text-away-gold font-semibold">Scores are provisional</span> during the group stage. Group standings are estimated from match results once every team in the group has played at least one game. Groups where any team hasn't played yet score 0. Standings will shift as more matches are played.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-away-cream/40"
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
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name..."
            className="w-full bg-away-green border border-away-moss rounded-lg pl-9 pr-4 py-2.5 text-away-cream placeholder-away-cream/30 focus:outline-none focus:border-away-gold text-sm"
          />
        </div>
        <label className="flex items-center gap-2 bg-away-green border border-away-moss rounded-lg px-4 py-2.5 text-sm font-medium text-away-cream/80 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={excludeLate}
            onChange={(e) => handleExcludeLateChange(e.target.checked)}
            className="w-4 h-4 rounded accent-away-gold cursor-pointer"
          />
          Hide late entries
        </label>
        <button
          onClick={() => load(page, search, excludeLate)}
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

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-away-gold animate-pulse text-lg font-semibold">Loading leaderboard...</div>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && total === 0 && !search && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🏆</div>
          <h3 className="text-xl font-bold text-away-cream mb-2">No picks yet!</h3>
          <p className="text-away-cream/60 text-sm mb-6">
            Be the first to fill out your bracket.
          </p>
          <Link
            to="/picks"
            className="inline-block bg-away-orange hover:bg-away-orange-light text-away-cream font-bold px-6 py-3 rounded-lg transition-colors"
          >
            Fill Out My Bracket
          </Link>
        </div>
      )}

      {/* No results from search */}
      {!loading && !error && total === 0 && search && (
        <div className="text-center py-12">
          <p className="text-away-cream/60">No contestants found matching "{search}"</p>
          <button
            onClick={() => handleSearchChange("")}
            className="mt-3 text-away-gold hover:text-away-gold-light text-sm underline"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Hosts spotlight */}
      {!loading && !error && pinned.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-away-gold font-display tracking-widest text-sm uppercase">The Hosts</span>
            <div className="flex-1 h-px bg-away-gold/20" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pinned.map((entry) => (
              <div
                key={entry.userId}
                className="bg-away-green border border-away-gold/40 rounded-xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-away-cream font-bold text-base leading-tight">{entry.display_name}</span>
                    {entry.is_late_entry && (
                      <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/40 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide self-start">Late Entry</span>
                    )}
                  </div>
                  <span className="text-away-cream/50 text-sm font-bold shrink-0">#{entry.rank}</span>
                </div>
                <div className="flex gap-4 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-away-cream/40 uppercase tracking-wider">GS</span>
                    <span className="text-away-cream/80 tabular-nums font-medium">{entry.group_stage_score}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-away-cream/40 uppercase tracking-wider">KO</span>
                    <span className="text-away-cream/80 tabular-nums font-medium">{entry.knockout_score}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-away-gold/80 uppercase tracking-wider">Total</span>
                    <span className="text-away-gold font-bold tabular-nums text-sm">{entry.total_score}</span>
                  </div>
                </div>
                <Link
                  to={`/bracket/${entry.userId}`}
                  className="text-xs text-away-gold/70 hover:text-away-gold underline transition-colors self-start"
                >
                  View bracket
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Your position sticky banner */}
      {!loading && !error && currentUserEntry && (
        <div className="mb-6 bg-away-green border border-away-gold/60 rounded-xl px-4 py-3 flex items-center gap-4">
          <div className="shrink-0">
            <span className="text-away-gold/60 text-xs uppercase tracking-wider font-bold">You</span>
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="text-away-gold font-bold text-lg">#{currentUserEntry.rank}</span>
            <span className="text-away-cream font-medium text-sm truncate">
                {currentUserEntry.display_name}
                {currentUserEntry.discriminator && (
                  <span className="text-away-cream/30 font-normal text-xs ml-0.5">#{currentUserEntry.discriminator}</span>
                )}
              </span>
            {currentUserEntry.is_late_entry && (
              <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/40 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide shrink-0">Late Entry</span>
            )}
          </div>
          <div className="flex gap-4 ml-auto shrink-0 text-xs">
            <div className="flex flex-col gap-0.5 items-end">
              <span className="text-away-cream/40 uppercase tracking-wider">GS</span>
              <span className="text-away-cream/80 tabular-nums font-medium">{currentUserEntry.group_stage_score}</span>
            </div>
            <div className="flex flex-col gap-0.5 items-end">
              <span className="text-away-cream/40 uppercase tracking-wider">KO</span>
              <span className="text-away-cream/80 tabular-nums font-medium">{currentUserEntry.knockout_score}</span>
            </div>
            <div className="flex flex-col gap-0.5 items-end">
              <span className="text-away-gold/80 uppercase tracking-wider">Total</span>
              <span className="text-away-gold font-bold tabular-nums text-sm">{currentUserEntry.total_score}</span>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && total > 0 && (
        <>
          {/* Score key */}
          <div className="flex flex-wrap gap-4 mb-4 text-xs text-away-cream/40">
            <span>GS = Group Stage Points</span>
            <span>KO = Knockout Points</span>
            <span>Total = GS + KO</span>
          </div>

          <div className="bg-away-green border border-away-moss rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-away-moss border-b border-away-green">
                    <th className="text-left px-4 py-3 text-xs font-bold text-away-cream/60 uppercase tracking-wider w-16">
                      Rank
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-away-cream/60 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-away-cream/60 uppercase tracking-wider">
                      GS Pts
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-away-cream/60 uppercase tracking-wider">
                      KO Pts
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-away-gold uppercase tracking-wider">
                      Total
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-away-cream/60 uppercase tracking-wider w-20">
                      Bracket
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-away-moss/50">
                  {entries.map((entry) => {
                    const badge = rankBadge(entry.rank);
                    const isCurrentUser = user && entry.userId === user.id;
                    return (
                      <tr
                        key={entry.userId}
                        className={`transition-colors hover:bg-away-moss/30 ${
                          isCurrentUser
                            ? "bg-away-gold/10 border-l-2 border-away-gold"
                            : entry.rank <= 3
                            ? "bg-away-moss/10"
                            : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {badge ? (
                              <span className="text-lg">{badge}</span>
                            ) : (
                              <span className="text-away-cream/50 font-bold text-sm w-6 text-center">
                                {entry.rank}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium text-sm ${isCurrentUser ? "text-away-gold" : "text-away-cream"}`}>
                              {entry.display_name}
                              {entry.discriminator && (
                                <span className="text-away-cream/30 font-normal text-xs ml-0.5">#{entry.discriminator}</span>
                              )}
                            </span>
                            {isCurrentUser && (
                              <span className="text-xs bg-away-gold/20 text-away-gold px-1.5 py-0.5 rounded font-bold">You</span>
                            )}
                            {entry.is_late_entry && (
                              <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/40 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Late Entry</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-away-cream/70 text-sm tabular-nums">
                            {entry.group_stage_score}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-away-cream/70 text-sm tabular-nums">
                            {entry.knockout_score}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-away-gold font-bold text-sm tabular-nums">
                            {entry.total_score}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            to={`/bracket/${entry.userId}`}
                            className="inline-flex items-center gap-1 text-xs text-away-gold hover:text-away-gold-light underline transition-colors"
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

          {/* Pagination footer */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-away-cream/40 text-xs">
              Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, total)} of{" "}
              {total} contestant{total !== 1 ? "s" : ""}
              {search ? ` matching "${search}"` : ""}
              {!search && !excludeLate && lateEntryCount > 0 && (
                <span className="text-away-cream/30"> · {totalEntrants - lateEntryCount} standard, {lateEntryCount} late</span>
              )}
              {excludeLate && lateEntryCount > 0 && (
                <span className="text-away-cream/30"> · {lateEntryCount} late entr{lateEntryCount !== 1 ? "ies" : "y"} hidden</span>
              )}
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(Math.max(1, safePage - 1))}
                  disabled={safePage === 1 || loading}
                  className="px-2.5 py-1.5 rounded text-xs font-medium text-away-cream/60 hover:text-away-cream hover:bg-away-moss border border-away-moss/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ‹ Prev
                </button>

                {pageNumbers(safePage, totalPages).map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-away-cream/30 text-xs select-none">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p)}
                      disabled={loading}
                      className={`min-w-[2rem] px-2 py-1.5 rounded text-xs font-medium border transition-colors ${
                        p === safePage
                          ? "bg-away-gold text-away-green border-away-gold font-bold"
                          : "text-away-cream/60 hover:text-away-cream hover:bg-away-moss border-away-moss/50"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}

                <button
                  onClick={() => goToPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage === totalPages || loading}
                  className="px-2.5 py-1.5 rounded text-xs font-medium text-away-cream/60 hover:text-away-cream hover:bg-away-moss border border-away-moss/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next ›
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
