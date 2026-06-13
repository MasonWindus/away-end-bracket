import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { getLeaderboard } from "../lib/api";
import { GROUPS } from "../data/teams";
import TeamFlag from "../components/TeamFlag";
import type { LeaderboardEntry } from "../types";

const PICKS_DEADLINE = new Date("2026-06-11T16:00:00Z");

function useCountdown(target: Date) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const diff = target.getTime() - Date.now();
    return Math.max(0, diff);
  });

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      const diff = target.getTime() - Date.now();
      setTimeLeft(Math.max(0, diff));
    }, 1000);
    return () => clearInterval(interval);
  }, [target, timeLeft]);

  const totalSecs = Math.floor(timeLeft / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const expired = timeLeft <= 0;

  return { days, hours, mins, secs, expired };
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center bg-away-green border border-away-moss rounded-lg px-4 py-3 min-w-[72px]">
      <span className="text-3xl sm:text-4xl font-bold text-away-gold tabular-nums font-display tracking-wider">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-xs text-away-cream/60 uppercase tracking-widest mt-1">{label}</span>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const countdown = useCountdown(PICKS_DEADLINE);
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null);
  const [totalEntrants, setTotalEntrants] = useState(0);

  useEffect(() => {
    if (!user) return;
    getLeaderboard(1, "")
      .then((data) => {
        setTotalEntrants(data.total);
        // Search by name to locate the user's own entry across all pages
        return getLeaderboard(1, user.display_name).then((results) => {
          const found = results.entries.find((e) => e.userId === user.id);
          setMyEntry(found ?? null);
        });
      })
      .catch(() => {});
  }, [user]);

  return (
    <div className="min-h-screen bg-away-forest">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-28 px-4">
        {/* Stadium background */}
        <div className="absolute inset-0">
          <img src="/background.png" alt="" className="w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-away-forest/80 backdrop-blur-sm" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-away-gold/10 border border-away-gold/30 rounded-full px-4 py-1.5 mb-6">
            <span className="text-away-gold text-sm font-semibold tracking-wide">The Away End</span>
          </div>

          <h1 className="font-display text-6xl sm:text-8xl tracking-widest text-away-gold leading-none mb-2">
            WORLD CUP 2026
          </h1>
          <p className="font-display text-3xl sm:text-4xl tracking-widest text-away-cream/90 mb-6">
            Bracket Contest
          </p>

          <p className="text-away-cream/70 text-lg sm:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
            48 teams. 12 groups. One champion. Predict the standings, pick your way through every knockout
            round, and crown a winner before the first whistle blows — then follow along all summer to see
            how you stack up.
          </p>

          {user ? (
            <div className="mb-12 max-w-2xl mx-auto w-full">
              {/* My entry dashboard */}
              <div className="bg-away-green/60 border border-away-gold/30 rounded-2xl p-6 mb-4 text-left">
                <p className="text-away-cream/60 text-xs font-semibold uppercase tracking-widest mb-3">
                  Your Entry — {user.display_name}
                </p>
                {myEntry ? (
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <div className="text-center">
                      <div className="font-display text-4xl text-away-gold font-bold">
                        #{myEntry.rank}
                      </div>
                      <div className="text-away-cream/50 text-xs mt-1">
                        of {totalEntrants} {totalEntrants === 1 ? "entry" : "entries"}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-display text-4xl text-away-cream font-bold">
                        {myEntry.total_score}
                      </div>
                      <div className="text-away-cream/50 text-xs mt-1">total points</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-away-cream/70 space-y-0.5">
                        <div><span className="text-away-cream/40 text-xs">Group stage</span><br /><span className="font-bold text-away-cream">{myEntry.group_stage_score} pts</span></div>
                        <div><span className="text-away-cream/40 text-xs">Knockout</span><br /><span className="font-bold text-away-cream">{myEntry.knockout_score} pts</span></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-away-cream/50 text-sm mb-5">
                    No score yet — scores are calculated after each match day.
                  </p>
                )}
                {myEntry && (
                  <p className="text-away-cream/40 text-xs mb-4">
                    Group stage scores are provisional until all group matches are played and may change as standings shift.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/picks"
                    className="inline-flex items-center gap-2 bg-away-orange hover:bg-away-orange-light text-away-cream font-bold px-5 py-2.5 rounded-lg text-sm transition-colors"
                  >
                    <img src="/favicon.png" alt="" className="w-4 h-4 object-contain" aria-hidden="true" />
                    {countdown.expired ? "View My Bracket" : "Edit My Bracket"}
                  </Link>
                  {myEntry && (
                    <Link
                      to={`/bracket/${user.id}`}
                      className="inline-flex items-center gap-2 bg-away-green hover:bg-away-moss text-away-cream font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors border border-away-moss"
                    >
                      Public View
                    </Link>
                  )}
                  <Link
                    to="/leaderboard"
                    className="inline-flex items-center gap-2 bg-away-green hover:bg-away-moss text-away-cream font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors border border-away-moss"
                  >
                    Full Leaderboard
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 bg-away-orange hover:bg-away-orange-light text-away-cream font-bold px-8 py-4 rounded-lg text-lg transition-colors shadow-lg shadow-away-forest/50"
              >
                <img src="/favicon.png" alt="" className="w-5 h-5 object-contain" aria-hidden="true" />
                Join the Contest
              </Link>
              <Link
                to="/leaderboard"
                className="inline-flex items-center justify-center gap-2 bg-away-green hover:bg-away-moss text-away-cream font-bold px-8 py-4 rounded-lg text-lg transition-colors border border-away-moss"
              >
                View Leaderboard
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Countdown */}
      <section className="py-12 px-4 border-t border-away-green">
        <div className="max-w-2xl mx-auto text-center">
          {countdown.expired ? (
            <div className="text-center">
              <p className="text-red-400 text-xl font-bold">Picks are locked!</p>
              <p className="text-away-cream/60 mt-1 text-sm">The deadline has passed.</p>
            </div>
          ) : (
            <>
              <p className="text-away-cream/60 text-sm font-semibold uppercase tracking-widest mb-4">
                Time Remaining to Submit Picks
              </p>
              <div className="flex justify-center gap-3">
                <CountdownUnit value={countdown.days} label="Days" />
                <div className="flex items-center text-away-moss text-2xl font-bold pb-4">:</div>
                <CountdownUnit value={countdown.hours} label="Hours" />
                <div className="flex items-center text-away-moss text-2xl font-bold pb-4">:</div>
                <CountdownUnit value={countdown.mins} label="Mins" />
                <div className="flex items-center text-away-moss text-2xl font-bold pb-4">:</div>
                <CountdownUnit value={countdown.secs} label="Secs" />
              </div>
              <p className="text-away-cream/40 text-xs mt-4">
                Deadline: June 11, 2026 at 4:00 PM UTC (before first match)
              </p>
            </>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-away-green/40">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-3xl tracking-widest text-away-gold text-center mb-10">
            How Scoring Works
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="bg-away-green border border-away-moss rounded-xl p-6">
              <div className="text-3xl mb-3">🏆</div>
              <h3 className="text-away-gold font-bold text-lg mb-2">Group Stage</h3>
              <p className="text-away-cream/70 text-sm leading-relaxed">
                Earn points for correctly predicting group standings. Points for 1st place, 2nd place,
                3rd place finishes in each of the 12 groups.
              </p>
            </div>
            <div className="bg-away-green border border-away-moss rounded-xl p-6">
              <div className="text-3xl mb-3">⚔️</div>
              <h3 className="text-away-gold font-bold text-lg mb-2">Knockout Rounds</h3>
              <p className="text-away-cream/70 text-sm leading-relaxed">
                Points multiply each round — picking the right team through the Round of 32, Last 16,
                Quarterfinals, Semifinals, and Final earns more and more points.
              </p>
            </div>
            <div className="bg-away-green border border-away-moss rounded-xl p-6">
              <div className="text-3xl mb-3">👑</div>
              <h3 className="text-away-gold font-bold text-lg mb-2">Champion Pick</h3>
              <p className="text-away-cream/70 text-sm leading-relaxed">
                The biggest points come from correctly picking the World Cup Champion. Who will lift the
                trophy on July 19, 2026?
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Groups preview */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-3xl tracking-widest text-away-gold text-center mb-2">
            2026 World Cup Groups
          </h2>
          <p className="text-away-cream/60 text-center mb-8 text-sm">48 teams across 12 groups — the biggest World Cup ever</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(GROUPS).map(([g, teams]) => (
              <div key={g} className="bg-away-green border border-away-moss rounded-lg p-3">
                <div className="text-away-gold font-bold text-xs uppercase tracking-widest mb-2">
                  Group {g}
                </div>
                <ul className="space-y-1">
                  {teams.map((t) => (
                    <li key={t.code} className="text-away-cream/80 text-xs flex items-center gap-1.5">
                      <TeamFlag code={t.code} />
                      <span>{t.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA footer */}
      {!user && (
        <section className="py-16 px-4 bg-away-gold/10 border-t border-away-gold/20">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="font-display text-3xl tracking-widest text-away-gold mb-3">
              Ready to Compete?
            </h2>
            <p className="text-away-cream/70 mb-6">
              Sign up with just your name and email — no password needed. We'll send you a magic link to
              get started.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-away-orange hover:bg-away-orange-light text-away-cream font-bold px-8 py-4 rounded-lg text-lg transition-colors"
            >
              Join the Contest
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
