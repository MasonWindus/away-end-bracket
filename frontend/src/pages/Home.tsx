import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

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
    <div className="flex flex-col items-center bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 min-w-[72px]">
      <span className="text-3xl sm:text-4xl font-bold text-emerald-400 tabular-nums">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-xs text-gray-400 uppercase tracking-widest mt-1">{label}</span>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const countdown = useCountdown(PICKS_DEADLINE);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-28 px-4">
        {/* Background grid decoration */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 40px,#10b981 40px,#10b981 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,#10b981 40px,#10b981 41px)",
          }}
        />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-1.5 mb-6">
            <span className="text-emerald-400 text-sm font-medium">FIFA World Cup 2026</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold text-white leading-tight mb-4">
            <span className="text-emerald-400">THE AWAY END</span>
            <br />
            Bracket Contest
          </h1>
          <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
            Hosted by <span className="text-white font-semibold">John Green</span> &amp;{" "}
            <span className="text-white font-semibold">Daniel Alarcón</span> — the soccer podcast for people who
            love the beautiful game. Predict the World Cup 2026 winner and compete with the Away End community.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            {user ? (
              <Link
                to="/picks"
                className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-4 rounded-lg text-lg transition-colors shadow-lg shadow-emerald-900/30"
              >
                <span>⚽</span>
                Fill Out My Bracket
              </Link>
            ) : (
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-4 rounded-lg text-lg transition-colors shadow-lg shadow-emerald-900/30"
              >
                <span>⚽</span>
                Join the Contest
              </Link>
            )}
            <Link
              to="/leaderboard"
              className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-bold px-8 py-4 rounded-lg text-lg transition-colors border border-gray-700"
            >
              View Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* Countdown */}
      <section className="py-12 px-4 border-t border-gray-800">
        <div className="max-w-2xl mx-auto text-center">
          {countdown.expired ? (
            <div className="text-center">
              <p className="text-red-400 text-xl font-bold">Picks are locked!</p>
              <p className="text-gray-400 mt-1 text-sm">The deadline has passed.</p>
            </div>
          ) : (
            <>
              <p className="text-gray-400 text-sm font-medium uppercase tracking-widest mb-4">
                Time Remaining to Submit Picks
              </p>
              <div className="flex justify-center gap-3">
                <CountdownUnit value={countdown.days} label="Days" />
                <div className="flex items-center text-gray-600 text-2xl font-bold pb-4">:</div>
                <CountdownUnit value={countdown.hours} label="Hours" />
                <div className="flex items-center text-gray-600 text-2xl font-bold pb-4">:</div>
                <CountdownUnit value={countdown.mins} label="Mins" />
                <div className="flex items-center text-gray-600 text-2xl font-bold pb-4">:</div>
                <CountdownUnit value={countdown.secs} label="Secs" />
              </div>
              <p className="text-gray-500 text-xs mt-4">
                Deadline: June 11, 2026 at 4:00 PM UTC (before first match)
              </p>
            </>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-gray-900/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-10">How Scoring Works</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
              <div className="text-3xl mb-3">🏆</div>
              <h3 className="text-emerald-400 font-bold text-lg mb-2">Group Stage</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Earn points for correctly predicting group standings. Points for 1st place, 2nd place,
                3rd place finishes in each of the 12 groups.
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
              <div className="text-3xl mb-3">⚔️</div>
              <h3 className="text-emerald-400 font-bold text-lg mb-2">Knockout Rounds</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Points multiply each round — picking the right team through the Round of 32, Last 16,
                Quarterfinals, Semifinals, and Final earns more and more points.
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
              <div className="text-3xl mb-3">👑</div>
              <h3 className="text-emerald-400 font-bold text-lg mb-2">Champion Pick</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
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
          <h2 className="text-2xl font-bold text-white text-center mb-2">2026 World Cup Groups</h2>
          <p className="text-gray-400 text-center mb-8 text-sm">48 teams across 12 groups — the biggest World Cup ever</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { g: "A", teams: ["Mexico", "South Africa", "Korea Republic", "Czechia"] },
              { g: "B", teams: ["Canada", "Bosnia & Herz.", "Qatar", "Switzerland"] },
              { g: "C", teams: ["Brazil", "Morocco", "Haiti", "Scotland"] },
              { g: "D", teams: ["United States", "Paraguay", "Australia", "Türkiye"] },
              { g: "E", teams: ["Germany", "Ivory Coast", "Ecuador", "Curaçao"] },
              { g: "F", teams: ["Netherlands", "Sweden", "Tunisia", "Japan"] },
              { g: "G", teams: ["Belgium", "Egypt", "Iran", "New Zealand"] },
              { g: "H", teams: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"] },
              { g: "I", teams: ["France", "Senegal", "Iraq", "Norway"] },
              { g: "J", teams: ["Argentina", "Algeria", "Austria", "Jordan"] },
              { g: "K", teams: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"] },
              { g: "L", teams: ["England", "Croatia", "Ghana", "Panama"] },
            ].map(({ g, teams }) => (
              <div key={g} className="bg-gray-900 border border-gray-700 rounded-lg p-3">
                <div className="text-emerald-400 font-bold text-xs uppercase tracking-widest mb-2">
                  Group {g}
                </div>
                <ul className="space-y-1">
                  {teams.map((t) => (
                    <li key={t} className="text-gray-300 text-xs">
                      {t}
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
        <section className="py-16 px-4 bg-emerald-900/20 border-t border-emerald-800/30">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Ready to compete?</h2>
            <p className="text-gray-400 mb-6">
              Sign up with just your name and email — no password needed. We'll send you a magic link to
              get started.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-4 rounded-lg text-lg transition-colors"
            >
              Join the Contest
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
