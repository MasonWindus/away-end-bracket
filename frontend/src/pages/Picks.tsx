import React, { useEffect, useState, useCallback } from "react";
import type { GroupPick, ThirdsPick, KnockoutPicks, GroupCode } from "../types";
import { useAuth } from "../lib/auth";
import {
  getGroupPicks,
  updateGroupPick,
  getThirdsPick,
  updateThirdsPick,
  getKnockoutPicks,
  updateKnockoutPicks,
  resetKnockoutPicks,
  getKnockoutDeadline,
} from "../lib/api";
import { GROUPS, GROUP_CODES, TEAM_NAMES } from "../data/teams";
import { buildR32Field } from "../lib/bracket";
import GroupCard from "../components/GroupCard";
import ThirdsPicker from "../components/ThirdsPicker";
import BracketView from "../components/BracketView";

const PICKS_DEADLINE = new Date("2026-06-11T16:00:00Z");

function useCountdown(target: Date) {
  const calc = () => Math.max(0, target.getTime() - Date.now());
  const [timeLeft, setTimeLeft] = useState(calc);

  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(interval);
  });

  const totalSecs = Math.floor(timeLeft / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return { days, hours, mins, secs, expired: timeLeft <= 0 };
}

type Step = 1 | 2 | 3;

// Get third-place teams from group picks
function getThirdPlaceTeams(groupPicks: GroupPick[]) {
  const pickMap: Record<string, GroupPick> = {};
  for (const p of groupPicks) {
    pickMap[p.group_code] = p;
  }
  return GROUP_CODES.map((g) => ({
    code: pickMap[g]?.third_place || "",
    name: pickMap[g]?.third_place ? (TEAM_NAMES[pickMap[g].third_place] || pickMap[g].third_place) : "",
    group: g,
  })).filter((t) => t.code);
}

function emptyKnockoutPicks(): KnockoutPicks {
  return {
    R16: Array(16).fill(""),
    QF: Array(8).fill(""),
    SF: Array(4).fill(""),
    Final: Array(2).fill(""),
    Champion: "",
    locked: false,
  };
}

const STEP_LABELS = ["Group Stage", "Thirds", "Knockout Bracket"];

export default function Picks() {
  const { user } = useAuth();
  const isLateEntry = user?.is_late_entry ?? false;
  const countdown = useCountdown(PICKS_DEADLINE);
  const isLocked = countdown.expired && !isLateEntry;

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [groupPicks, setGroupPicks] = useState<GroupPick[]>([]);
  const [thirdsPick, setThirdsPick] = useState<ThirdsPick | null>(null);
  const [knockoutPicks, setKnockoutPicks] = useState<KnockoutPicks>(emptyKnockoutPicks());

  const [knockoutDeadline, setKnockoutDeadline] = useState<string | null>(null);
  const [knockoutDeadlineLoaded, setKnockoutDeadlineLoaded] = useState(false);
  const knockoutIsLocked = !isLateEntry && knockoutDeadlineLoaded && knockoutDeadline !== null && new Date() > new Date(knockoutDeadline);
  const knockoutCountdown = useCountdown(knockoutDeadline ? new Date(knockoutDeadline) : new Date(8640000000000000));

  // Thirdsslots: admin may have assigned which thirds go to which bracket slot
  const [thirdsSlots] = useState<Record<number, string>>({});

  const [savingKnockout, setSavingKnockout] = useState(false);
  const [savingThirds, setSavingThirds] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Track when thirds picks have been invalidated by a group stage change
  const [thirdsInvalidated, setThirdsInvalidated] = useState(false);

  const BRACKET_FIX_NOTICE_KEY = "bracketFixNotice_v1";
  const KNOCKOUT_STALE_WARNING_KEY = "knockoutStaleWarning_v1";
  const [showBracketNotice, setShowBracketNotice] = useState(
    () => localStorage.getItem(BRACKET_FIX_NOTICE_KEY) !== "dismissed"
  );
  const [showKnockoutWarning, setShowKnockoutWarning] = useState(
    () => localStorage.getItem(KNOCKOUT_STALE_WARNING_KEY) !== "dismissed"
  );
  // Snapshot whether the user already had picks when the page loaded — used to
  // gate the bracket-fix notice so it doesn't fire mid-interaction when a user
  // makes their first pick on an empty bracket.
  const [hadPicksOnLoad, setHadPicksOnLoad] = useState(false);
  function dismissBracketNotice() {
    localStorage.setItem(BRACKET_FIX_NOTICE_KEY, "dismissed");
    setShowBracketNotice(false);
  }
  function dismissKnockoutWarning() {
    localStorage.setItem(KNOCKOUT_STALE_WARNING_KEY, "dismissed");
    setShowKnockoutWarning(false);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gp, tp, kp, kd] = await Promise.all([
        getGroupPicks(),
        getThirdsPick().catch(() => null),
        getKnockoutPicks().catch(() => null),
        getKnockoutDeadline().catch(() => ({ deadline: null, locked: false })),
      ]);
      setGroupPicks(gp);
      setThirdsPick(tp);
      if (kp) {
        setKnockoutPicks(kp);
        if (kp.R16.some(Boolean)) setHadPicksOnLoad(true);
      }
      setKnockoutDeadline(kd.deadline);
      setKnockoutDeadlineLoaded(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load picks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // When group picks change, remove any thirds picks that are no longer valid
  // 3rd-place teams (e.g. user changed who finishes 3rd in a group after already
  // selecting their thirds). Uses functional update to avoid stale closure.
  useEffect(() => {
    setThirdsPick((prev) => {
      if (!prev || prev.teams.length === 0) return prev;
      const validCodes = new Set(getThirdPlaceTeams(groupPicks).map((t) => t.code));
      const validTeams = prev.teams.filter((c) => validCodes.has(c));
      if (validTeams.length !== prev.teams.length) {
        setThirdsInvalidated(true);
        return { ...prev, teams: validTeams };
      }
      return prev;
    });
  }, [groupPicks]);

  const groupSavedCount = groupPicks.filter(
    (p) => p.first_place && p.second_place && p.third_place && p.fourth_place
  ).length;

  const allGroupsDone = groupSavedCount === 12;

  async function handleGroupSave(code: GroupCode, pick: Omit<GroupPick, "group_code" | "locked">) {
    const saved = await updateGroupPick(code, pick);
    setGroupPicks((prev) => {
      const idx = prev.findIndex((p) => p.group_code === code);
      if (idx === -1) return [...prev, saved];
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
  }

  async function handleThirdsSave(teams: string[]) {
    setSavingThirds(true);
    setSaveMsg(null);
    try {
      const saved = await updateThirdsPick(teams);
      setThirdsPick(saved);
      setThirdsInvalidated(false);
      setSaveMsg("Thirds picks saved!");
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : "Failed to save thirds.");
    } finally {
      setSavingThirds(false);
    }
  }

  async function handleKnockoutSave() {
    setSavingKnockout(true);
    setSaveMsg(null);
    try {
      const { locked: _l, ...rest } = knockoutPicks;
      const saved = await updateKnockoutPicks(rest);
      setKnockoutPicks(saved);
      if (saved.Champion) {
        setShowCompletionModal(true);
      } else {
        setSaveMsg("Bracket picks saved!");
        setTimeout(() => setSaveMsg(null), 3000);
      }
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : "Failed to save bracket.");
    } finally {
      setSavingKnockout(false);
    }
  }

  async function handleKnockoutReset() {
    if (!confirm("This will clear all your knockout bracket picks. Are you sure?")) return;
    setSavingKnockout(true);
    setSaveMsg(null);
    try {
      await resetKnockoutPicks();
      setKnockoutPicks(emptyKnockoutPicks());
      setSaveMsg("Bracket cleared. Start fresh!");
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : "Failed to reset bracket.");
    } finally {
      setSavingKnockout(false);
    }
  }

  const thirdPlaceTeams = getThirdPlaceTeams(groupPicks);
  const r32Field = buildR32Field(groupPicks, thirdsPick, thirdsSlots);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-away-gold text-lg animate-pulse font-semibold">Loading your picks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={load}
            className="bg-away-orange hover:bg-away-orange-light text-away-cream px-6 py-2 rounded-lg font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${step !== 3 ? "max-w-7xl mx-auto" : ""} px-4 sm:px-6 lg:px-8 py-6`}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-4xl tracking-widest text-away-gold mb-1">My Bracket Picks</h1>
        <p className="text-away-cream/60 text-sm">Fill out your predictions for the 2026 World Cup</p>
      </div>

      {/* Deadline countdown */}
      <div
        className={`mb-6 rounded-xl border px-4 py-3 flex flex-wrap items-center gap-4 ${
          isLocked
            ? "bg-red-900/20 border-red-700/50"
            : "bg-away-gold/10 border-away-gold/30"
        }`}
      >
        {isLocked ? (
          <div>
            <span className="text-red-400 font-bold text-sm">Picks Locked</span>
            <p className="text-away-cream/60 text-xs">The deadline has passed. You can view your picks below.</p>
          </div>
        ) : (
          <>
            <div>
              <span className="text-away-gold font-bold text-sm">Picks Deadline:</span>
              <span className="text-away-cream/80 text-sm ml-2">June 11, 2026 at 4:00 PM UTC</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-away-cream/50 text-xs">Time left:</span>
              <span className="text-away-gold font-mono font-bold text-sm">
                {countdown.days}d {String(countdown.hours).padStart(2, "0")}h{" "}
                {String(countdown.mins).padStart(2, "0")}m {String(countdown.secs).padStart(2, "0")}s
              </span>
            </div>
          </>
        )}
      </div>

      {/* Bracket fix modal */}
      {showBracketNotice && !loading && hadPicksOnLoad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-away-green border-2 border-amber-500 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-amber-300 font-display tracking-wide">
                Check Your Knockout Bracket!
              </h2>
            </div>
            <p className="text-away-cream/90 text-sm leading-relaxed mb-3">
              We updated the R32 bracket to match the official FIFA 2026 draw — no same-group teams can meet before the Final.
            </p>
            <p className="text-amber-300 text-sm font-semibold mb-6">
              Your existing knockout picks may no longer reflect valid matchups. Please review and update your bracket before the knockout deadline.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { dismissBracketNotice(); setStep(3); }}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors"
              >
                Review My Bracket
              </button>
              <button
                onClick={dismissBracketNotice}
                className="py-3 px-4 bg-away-moss hover:bg-away-green/80 text-away-cream/70 rounded-xl transition-colors text-sm border border-away-moss"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Knockout stale entries warning modal */}
      {showKnockoutWarning && !loading && hadPicksOnLoad && !showBracketNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-away-green border-2 border-away-orange rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-away-orange/20 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-7 h-7 text-away-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-away-cream font-display tracking-wide">
                Knockout Picks Lock Tomorrow!
              </h2>
            </div>
            <p className="text-away-cream/90 text-sm leading-relaxed mb-3">
              The knockout round matchups have been updated since you last made picks.
            </p>
            <p className="text-away-orange text-sm font-semibold mb-6">
              Please review your bracket and make sure your picks still reflect the correct matchups before the deadline tomorrow.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { dismissKnockoutWarning(); setStep(3); }}
                className="flex-1 py-3 bg-away-orange hover:bg-away-orange-light text-away-cream font-bold rounded-xl transition-colors"
              >
                Review My Bracket
              </button>
              <button
                onClick={dismissKnockoutWarning}
                className="py-3 px-4 bg-away-moss hover:bg-away-green/80 text-away-cream/70 rounded-xl transition-colors text-sm border border-away-moss"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bracket complete modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-away-green border-2 border-away-gold rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-away-gold/20 rounded-full flex items-center justify-center">
                <svg className="w-9 h-9 text-away-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-away-gold font-display tracking-wide mb-2">
              Bracket Complete!
            </h2>
            <p className="text-away-cream/80 text-sm mb-3">
              Your picks are saved and ready to go.
            </p>
            <div className="bg-away-moss/60 rounded-xl px-4 py-3 mb-6 border border-away-gold/30">
              <p className="text-away-cream/50 text-xs uppercase tracking-widest mb-1">Your Champion</p>
              <p className="text-away-gold font-bold text-lg">
                {TEAM_NAMES[knockoutPicks.Champion] || knockoutPicks.Champion}
              </p>
            </div>
            <button
              onClick={() => setShowCompletionModal(false)}
              className="w-full py-3 bg-away-gold hover:bg-away-gold/80 text-away-forest font-bold rounded-xl transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2, 3] as Step[]).map((s) => (
          <React.Fragment key={s}>
            <button
              onClick={() => {
                if (s === 2 && !allGroupsDone) return;
                if (s === 3 && !allGroupsDone) return;
                setStep(s);
              }}
              disabled={s === 2 && !allGroupsDone || s === 3 && !allGroupsDone}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                step === s
                  ? "bg-away-gold text-away-forest"
                  : s < step || (s === 2 && allGroupsDone) || (s === 3 && allGroupsDone)
                  ? "bg-away-green text-away-gold hover:bg-away-moss cursor-pointer border border-away-moss"
                  : "bg-away-green text-away-cream/30 cursor-not-allowed border border-away-moss/50"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                  step === s ? "bg-away-forest text-away-gold" : "bg-away-moss text-away-cream/60"
                }`}
              >
                {s}
              </span>
              <span className="hidden sm:inline">{STEP_LABELS[s - 1]}</span>
              {s === 2 && thirdsInvalidated && step !== 2 && (
                <span className="w-2 h-2 rounded-full bg-away-orange shrink-0" aria-label="Thirds need attention" />
              )}
            </button>
            {s < 3 && <div className="flex-1 h-px bg-away-moss" />}
          </React.Fragment>
        ))}
      </div>

      {/* Save message */}
      {saveMsg && (
        <div
          className={`mb-4 rounded-lg px-4 py-2 text-sm font-medium ${
            saveMsg.includes("Failed") || saveMsg.includes("failed")
              ? "bg-red-900/30 border border-red-700 text-red-400"
              : "bg-away-gold/20 border border-away-gold/50 text-away-gold"
          }`}
        >
          {saveMsg}
        </div>
      )}

      {/* ---- STEP 1: Group Stage ---- */}
      {step === 1 && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-bold text-away-cream">Group Stage Picks</h2>
              <p className="text-away-cream/60 text-sm mt-0.5">
                Rank the teams 1st through 4th in each group
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                  allGroupsDone ? "bg-away-gold text-away-forest" : "bg-away-moss text-away-cream/70"
                }`}
              >
                {groupSavedCount} / 12 groups complete
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {GROUP_CODES.map((code) => {
              const pick = groupPicks.find((p) => p.group_code === code) || null;
              return (
                <GroupCard
                  key={code}
                  groupCode={code}
                  teams={GROUPS[code]}
                  picks={pick}
                  onSave={(p) => handleGroupSave(code as GroupCode, p)}
                  locked={isLocked}
                />
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!allGroupsDone}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-colors ${
                allGroupsDone
                  ? "bg-away-orange hover:bg-away-orange-light text-away-cream"
                  : "bg-away-moss text-away-cream/30 cursor-not-allowed"
              }`}
            >
              Next: Thirds Picks
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {!allGroupsDone && (
            <p className="text-away-cream/40 text-xs text-right mt-2">
              Complete all 12 groups to continue
            </p>
          )}
        </div>
      )}

      {/* ---- STEP 2: Thirds ---- */}
      {step === 2 && (
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-away-cream mb-1">Third-Place Teams</h2>
            <p className="text-away-cream/60 text-sm">
              In a 48-team World Cup, the best 8 of the 12 third-place teams advance to the
              knockout round. Select which 8 you think will qualify.
            </p>
          </div>

          {thirdsInvalidated && (
            <div className="mb-4 rounded-xl border border-away-orange/50 bg-away-orange/10 px-4 py-3 flex items-start gap-3">
              <svg className="w-5 h-5 text-away-orange shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-away-orange font-semibold text-sm">Thirds picks need updating</p>
                <p className="text-away-cream/70 text-xs mt-0.5">
                  One or more of your thirds picks is no longer a valid third-place team because you changed a group. Please re-select to fill all 8 spots.
                </p>
              </div>
              <button
                onClick={() => setThirdsInvalidated(false)}
                className="shrink-0 text-away-cream/40 hover:text-away-cream/80 transition-colors"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <ThirdsPicker
            thirdPlaceTeams={thirdPlaceTeams}
            selected={thirdsPick?.teams || []}
            onChange={(teams) => {
              setThirdsPick((prev) => ({ teams, locked: prev?.locked || false }));
            }}
            locked={isLocked}
          />

          <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-away-green hover:bg-away-moss text-away-cream/80 font-medium transition-colors border border-away-moss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  const teams = thirdsPick?.teams || [];
                  if (!isLocked && teams.length === 8) {
                    await handleThirdsSave(teams);
                  }
                  setStep(3);
                }}
                disabled={savingThirds || (thirdsPick?.teams || []).length !== 8}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-colors ${
                  (thirdsPick?.teams || []).length === 8
                    ? "bg-away-orange hover:bg-away-orange-light text-away-cream"
                    : "bg-away-moss text-away-cream/30 cursor-not-allowed"
                }`}
              >
                {savingThirds ? "Saving..." : "Next: Bracket"}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- STEP 3: Knockout Bracket ---- */}
      {step === 3 && (
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-away-cream mb-1">Knockout Bracket</h2>
            <p className="text-away-cream/60 text-sm">
              Click a team to advance them to the next round. Work from the outside in toward the
              champion.
            </p>
          </div>

          {/* Knockout deadline status */}
          {knockoutDeadlineLoaded && (
            <div
              className={`mb-4 rounded-xl border px-4 py-3 flex flex-wrap items-center gap-4 ${
                knockoutIsLocked
                  ? "bg-red-900/20 border-red-700/50"
                  : "bg-away-gold/10 border-away-gold/30"
              }`}
            >
              {knockoutIsLocked ? (
                <div>
                  <span className="text-red-400 font-bold text-sm">Knockout Picks Locked</span>
                  <p className="text-away-cream/60 text-xs">The knockout deadline has passed. You can view your bracket below.</p>
                </div>
              ) : knockoutDeadline ? (
                <>
                  <div>
                    <span className="text-away-gold font-bold text-sm">Knockout Deadline:</span>
                    <span className="text-away-cream/80 text-sm ml-2">
                      {new Date(knockoutDeadline).toLocaleString("en-US", {
                        month: "long", day: "numeric", year: "numeric",
                        hour: "2-digit", minute: "2-digit", timeZoneName: "short",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-away-cream/50 text-xs">Time left:</span>
                    <span className="text-away-gold font-mono font-bold text-sm">
                      {knockoutCountdown.days}d {String(knockoutCountdown.hours).padStart(2, "0")}h{" "}
                      {String(knockoutCountdown.mins).padStart(2, "0")}m {String(knockoutCountdown.secs).padStart(2, "0")}s
                    </span>
                  </div>
                </>
              ) : (
                <div>
                  <span className="text-away-gold font-bold text-sm">Knockout Picks Open</span>
                  <p className="text-away-cream/60 text-xs">No deadline set yet — you can update your bracket freely.</p>
                </div>
              )}
            </div>
          )}

          <BracketView
            r32Field={r32Field}
            thirdsSlots={thirdsSlots}
            picks={knockoutPicks}
            onPicksChange={setKnockoutPicks}
            locked={knockoutIsLocked}
          />

          <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-away-green hover:bg-away-moss text-away-cream/80 font-medium transition-colors border border-away-moss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              {!knockoutIsLocked && (
                <button
                  onClick={handleKnockoutReset}
                  disabled={savingKnockout}
                  className="text-sm text-away-cream/40 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  Start from scratch
                </button>
              )}
            </div>

            {!knockoutIsLocked && (
              <button
                onClick={handleKnockoutSave}
                disabled={savingKnockout}
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-bold bg-away-orange hover:bg-away-orange-light text-away-cream transition-colors disabled:opacity-60"
              >
                {savingKnockout ? (
                  <>
                    <div className="w-4 h-4 border-2 border-away-cream border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Bracket Picks
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
