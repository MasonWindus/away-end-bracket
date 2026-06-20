import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  getGroupResults,
  submitGroupResult,
  submitThirdsResult,
  submitKnockoutResult,
  recalculate,
  getRecalculateStatus,
  getAdminUsers,
  getMatches,
  submitMatch,
  deleteMatch,
  pinUser,
  unpinUser,
  markLateEntry,
  unmarkLateEntry,
  backfillLateEntries,
  getBugReports,
  updateBugReportStatus,
  backfillBugReportDisplayNames,
  getKnockoutDeadlineConfig,
  setKnockoutDeadlineConfig,
  type BugReport,
} from "../lib/api";
import { GROUPS, GROUP_CODES, TEAM_NAMES } from "../data/teams";
import TeamFlag from "../components/TeamFlag";
import type { GroupCode, GroupResult, ThirdsResult, AdminUser, MatchResult } from "../types";

type Tab = "matches" | "groups" | "thirds" | "knockout" | "recalculate" | "users" | "bugs" | "settings";

// ─── Group Results Section ────────────────────────────────────────────────────
function GroupResultsSection({ groupResults, onResultSaved }: {
  groupResults: Record<string, GroupResult>;
  onResultSaved: () => void;
}) {
  const [forms, setForms] = useState<Record<string, GroupResult>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    const init: Record<string, GroupResult> = {};
    for (const code of GROUP_CODES) {
      init[code] = groupResults[code] || {
        group_code: code as GroupCode,
        first_place: "",
        second_place: "",
        third_place: "",
        fourth_place: "",
      };
    }
    setForms(init);
  }, [groupResults]);

  function updateField(code: string, field: keyof GroupResult, value: string) {
    setForms((prev) => ({
      ...prev,
      [code]: { ...prev[code], [field]: value },
    }));
  }

  async function saveGroup(code: string) {
    const f = forms[code];
    if (!f.first_place || !f.second_place || !f.third_place || !f.fourth_place) {
      setMessages((m) => ({ ...m, [code]: "All 4 positions required." }));
      return;
    }
    setSaving(code);
    try {
      await submitGroupResult(code as GroupCode, {
        first_place: f.first_place,
        second_place: f.second_place,
        third_place: f.third_place,
        fourth_place: f.fourth_place,
      });
      setMessages((m) => ({ ...m, [code]: "✓ Saved" }));
      onResultSaved();
    } catch (err: unknown) {
      setMessages((m) => ({ ...m, [code]: err instanceof Error ? err.message : "Error" }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-gray-400 text-sm">Enter final standings for each group (1st–4th place).</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {GROUP_CODES.map((code) => {
          const teams = GROUPS[code];
          const form = forms[code] || { first_place: "", second_place: "", third_place: "", fourth_place: "" };
          const positions: Array<[keyof GroupResult, string]> = [
            ["first_place", "1st"],
            ["second_place", "2nd"],
            ["third_place", "3rd"],
            ["fourth_place", "4th"],
          ];
          return (
            <div key={code} className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
              <h3 className="text-emerald-400 font-bold text-sm uppercase tracking-wider">Group {code}</h3>
              {positions.map(([field, label]) => (
                <div key={field} className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs w-8 shrink-0">{label}</span>
                  <select
                    value={form[field] as string}
                    onChange={(e) => updateField(code, field, e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Select --</option>
                    {teams.map((t) => (
                      <option key={t.code} value={t.code}>{t.name}</option>
                    ))}
                  </select>
                </div>
              ))}
              {messages[code] && (
                <p className={`text-xs ${messages[code].startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                  {messages[code]}
                </p>
              )}
              <button
                onClick={() => saveGroup(code)}
                disabled={saving === code}
                className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm rounded font-medium transition-colors"
              >
                {saving === code ? "Saving..." : "Save Result"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Match Results Section ────────────────────────────────────────────────────
function MatchResultsSection() {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupCode>("A");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [homeGoals, setHomeGoals] = useState("");
  const [awayGoals, setAwayGoals] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadMatches() {
    setLoading(true);
    try {
      setMatches(await getMatches());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMatches(); }, []);

  const groupTeams = GROUPS[selectedGroup] || [];
  const availableAway = groupTeams.filter((t) => t.code !== homeTeam);

  async function handleSave() {
    if (!homeTeam || !awayTeam) { setMessage("Select both teams."); return; }
    if (homeTeam === awayTeam) { setMessage("Teams must be different."); return; }
    const hg = parseInt(homeGoals, 10);
    const ag = parseInt(awayGoals, 10);
    if (isNaN(hg) || isNaN(ag) || hg < 0 || ag < 0) {
      setMessage("Goals must be non-negative numbers.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await submitMatch({ group_code: selectedGroup, home_team: homeTeam, away_team: awayTeam, home_goals: hg, away_goals: ag });
      setMessage("✓ Match result saved");
      setHomeTeam(""); setAwayTeam(""); setHomeGoals(""); setAwayGoals("");
      await loadMatches();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(matchId: string) {
    if (!confirm("Delete this match result?")) return;
    try {
      await deleteMatch(matchId);
      setMatches((prev) => prev.filter((m) => m.match_id !== matchId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error deleting");
    }
  }

  const matchesByGroup = GROUP_CODES.reduce<Record<string, MatchResult[]>>((acc, g) => {
    acc[g] = matches.filter((m) => m.group_code === g);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <p className="text-gray-400 text-sm">
        Enter individual match scores as games are played. Scores are used to calculate provisional group
        standings for any group where final results haven't been set yet. Hit <strong className="text-white">Recalculate Scores</strong> after
        entering results to update the leaderboard.
      </p>

      {/* Entry form */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
        <h3 className="text-white font-semibold">Enter Match Result</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-gray-400 text-xs">Group</label>
            <select
              value={selectedGroup}
              onChange={(e) => { setSelectedGroup(e.target.value as GroupCode); setHomeTeam(""); setAwayTeam(""); }}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {GROUP_CODES.map((g) => <option key={g} value={g}>Group {g}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-gray-400 text-xs">Home Team</label>
            <select
              value={homeTeam}
              onChange={(e) => { setHomeTeam(e.target.value); setAwayTeam(""); }}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">-- Select --</option>
              {groupTeams.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </div>
          <div className="space-y-1 w-16">
            <label className="text-gray-400 text-xs">Goals</label>
            <input
              type="number" min="0" value={homeGoals}
              onChange={(e) => setHomeGoals(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm text-white text-center focus:outline-none focus:border-emerald-500"
              placeholder="0"
            />
          </div>
          <span className="text-gray-500 text-lg font-bold pb-1">–</span>
          <div className="space-y-1 w-16">
            <label className="text-gray-400 text-xs">Goals</label>
            <input
              type="number" min="0" value={awayGoals}
              onChange={(e) => setAwayGoals(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm text-white text-center focus:outline-none focus:border-emerald-500"
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-gray-400 text-xs">Away Team</label>
            <select
              value={awayTeam}
              onChange={(e) => setAwayTeam(e.target.value)}
              disabled={!homeTeam}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            >
              <option value="">-- Select --</option>
              {availableAway.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm rounded font-medium transition-colors"
          >
            {saving ? "Saving..." : "Save Result"}
          </button>
        </div>
        {message && (
          <p className={`text-sm ${message.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{message}</p>
        )}
      </div>

      {/* Entered matches grouped by group */}
      {loading ? (
        <div className="text-emerald-400 animate-pulse text-sm">Loading matches...</div>
      ) : (
        <div className="space-y-4">
          {GROUP_CODES.map((g) => {
            const gMatches = matchesByGroup[g];
            if (gMatches.length === 0) return null;
            return (
              <div key={g} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                <h4 className="text-emerald-400 font-bold text-xs uppercase tracking-wider mb-3">Group {g}</h4>
                <div className="space-y-2">
                  {gMatches.map((m) => (
                    <div key={m.match_id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-white">
                        <TeamFlag code={m.home_team} />
                        <span className="font-medium">{TEAM_NAMES[m.home_team] || m.home_team}</span>
                        <span className="tabular-nums font-bold text-emerald-400 mx-1">{m.home_goals} – {m.away_goals}</span>
                        <span className="font-medium">{TEAM_NAMES[m.away_team] || m.away_team}</span>
                        <TeamFlag code={m.away_team} />
                      </div>
                      <button
                        onClick={() => handleDelete(m.match_id)}
                        className="text-gray-500 hover:text-red-400 text-xs ml-4 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {matches.length === 0 && (
            <p className="text-gray-500 text-sm">No match results entered yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Thirds Result Section ────────────────────────────────────────────────────
function ThirdsResultSection({ onSaved }: { onSaved: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [slots, setSlots] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function toggle(code: string) {
    if (selected.includes(code)) {
      setSelected(selected.filter((c) => c !== code));
    } else if (selected.length < 8) {
      setSelected([...selected, code]);
    }
  }

  function updateSlot(slot: string, team: string) {
    setSlots((prev) => ({ ...prev, [slot]: team }));
  }

  async function handleSave() {
    if (selected.length !== 8) {
      setMessage("Select exactly 8 teams.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const data: ThirdsResult = {
        qualified_thirds: selected,
        bracket_slots: slots,
      };
      await submitThirdsResult(data);
      setMessage("✓ Saved successfully");
      onSaved();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-gray-400 text-sm">
        Select the 8 third-place teams that qualified for the knockout stage. Then assign them to bracket slots 1–8.
      </p>

      <div>
        <h3 className="text-white font-semibold mb-3">
          Select 8 Qualified Third-Place Teams ({selected.length}/8)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {GROUP_CODES.map((code) => {
            const group = GROUPS[code];
            // Just list all teams from all groups for admin to pick from
            return group.map((team) => {
              const isSelected = selected.includes(team.code);
              const disabled = !isSelected && selected.length >= 8;
              return (
                <button
                  key={team.code}
                  onClick={() => toggle(team.code)}
                  disabled={disabled}
                  className={`p-2.5 rounded-lg border text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-emerald-700/40 border-emerald-500 text-white"
                      : disabled
                      ? "bg-gray-800/40 border-gray-700 text-gray-600 cursor-not-allowed"
                      : "bg-gray-800 border-gray-600 text-gray-300 hover:border-emerald-600"
                  }`}
                >
                  <div className="text-xs text-emerald-400 font-bold">Grp {code}</div>
                  <div className="font-medium flex items-center gap-1.5"><TeamFlag code={team.code} />{team.name}</div>
                </button>
              );
            });
          })}
        </div>
      </div>

      {selected.length > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-3">Assign to Bracket Slots (1–8)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 8 }, (_, i) => String(i + 1)).map((slot) => (
              <div key={slot} className="flex items-center gap-3">
                <span className="text-gray-400 text-sm w-14 shrink-0">Slot {slot}</span>
                <select
                  value={slots[slot] || ""}
                  onChange={(e) => updateSlot(slot, e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Assign team --</option>
                  {selected.map((code) => (
                    <option key={code} value={code}>{TEAM_NAMES[code] || code}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {message && (
        <p className={`text-sm ${message.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{message}</p>
      )}
      <button
        onClick={handleSave}
        disabled={saving || selected.length !== 8}
        className="px-6 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded font-medium transition-colors"
      >
        {saving ? "Saving..." : "Save Thirds Result"}
      </button>
    </div>
  );
}

// ─── Knockout Results Section ─────────────────────────────────────────────────
function KnockoutResultSection({ onSaved }: { onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Simple textarea-based input for each round (comma-separated team codes)
  const [inputs, setInputs] = useState({ R32Winners: "", R16Winners: "", QFWinners: "", SFWinners: "", champion: "" });

  function parseTeams(val: string): string[] {
    return val.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  }

  async function handleSave() {
    const R32Winners = parseTeams(inputs.R32Winners);
    const R16Winners = parseTeams(inputs.R16Winners);
    const QFWinners = parseTeams(inputs.QFWinners);
    const SFWinners = parseTeams(inputs.SFWinners);
    const champion = inputs.champion.trim().toUpperCase();

    if (R32Winners.length !== 16) { setMessage("R32 winners: need exactly 16 teams"); return; }
    if (R16Winners.length !== 8) { setMessage("R16 winners: need exactly 8 teams"); return; }
    if (QFWinners.length !== 4) { setMessage("QF winners: need exactly 4 teams"); return; }
    if (SFWinners.length !== 2) { setMessage("SF winners: need exactly 2 teams"); return; }
    if (!champion) { setMessage("Champion is required"); return; }

    setSaving(true);
    setMessage("");
    try {
      await submitKnockoutResult({ R32Winners, R16Winners, QFWinners, SFWinners, champion });
      setMessage("✓ Knockout results saved");
      onSaved();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }

  const rounds: Array<[keyof typeof inputs, string, number]> = [
    ["R32Winners", "R32 Winners (16 teams)", 16],
    ["R16Winners", "R16 Winners (8 teams)", 8],
    ["QFWinners", "QF Winners (4 teams)", 4],
    ["SFWinners", "SF Winners / Finalists (2 teams)", 2],
    ["champion", "Champion (1 team)", 1],
  ];

  return (
    <div className="space-y-5">
      <p className="text-gray-400 text-sm">
        Enter team codes (e.g. BRA, FRA) comma-separated for each round. Enter results after they are final.
      </p>
      {rounds.map(([field, label, count]) => (
        <div key={field} className="space-y-1.5">
          <label className="text-gray-300 text-sm font-medium block">
            {label} <span className="text-gray-500 font-normal">({count} team{count > 1 ? "s" : ""})</span>
          </label>
          <input
            type="text"
            value={inputs[field]}
            onChange={(e) => setInputs((prev) => ({ ...prev, [field]: e.target.value }))}
            placeholder={count === 1 ? "e.g. BRA" : "e.g. BRA, FRA, ARG, ..."}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-gray-600"
          />
        </div>
      ))}
      {message && (
        <p className={`text-sm ${message.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{message}</p>
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded font-medium transition-colors"
      >
        {saving ? "Saving..." : "Save Knockout Results"}
      </button>
    </div>
  );
}

// ─── Settings Section ─────────────────────────────────────────────────────────
function SettingsSection() {
  const [deadlineInput, setDeadlineInput] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await getKnockoutDeadlineConfig();
        setCurrent(data.deadline);
        if (data.deadline) {
          // Convert ISO to local datetime-local string for the input
          const d = new Date(data.deadline);
          const offset = d.getTimezoneOffset() * 60000;
          const local = new Date(d.getTime() - offset);
          setDeadlineInput(local.toISOString().slice(0, 16));
        }
      } catch {
        // ignore
      } finally {
        setConfigLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!deadlineInput) {
      setMessage("Enter a deadline date and time.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const isoString = new Date(deadlineInput).toISOString();
      await setKnockoutDeadlineConfig(isoString);
      setCurrent(isoString);
      setMessage(`✓ Knockout deadline set to ${new Date(isoString).toLocaleString()}`);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!confirm("Clear the knockout deadline? Knockout picks will be open until a new deadline is set.")) return;
    setSaving(true);
    setMessage("");
    try {
      await setKnockoutDeadlineConfig(null);
      setCurrent(null);
      setDeadlineInput("");
      setMessage("✓ Knockout deadline cleared. Picks are now open.");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Error clearing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-white font-semibold mb-1">Knockout Round Picks Deadline</h3>
        <p className="text-gray-400 text-sm mb-4">
          Set when knockout bracket picks lock. Group stage and thirds picks are locked at
          June 11, 2026 at 4:00 PM UTC — that cannot be changed here. The knockout deadline
          is set separately so players can update their bracket once the group stage plays out.
        </p>

        {configLoading ? (
          <div className="text-emerald-400 animate-pulse text-sm">Loading...</div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Current knockout deadline</div>
              <div className={`text-sm font-medium ${current ? "text-white" : "text-gray-500"}`}>
                {current
                  ? new Date(current).toLocaleString("en-US", {
                      month: "long", day: "numeric", year: "numeric",
                      hour: "2-digit", minute: "2-digit", timeZoneName: "short",
                    })
                  : "Not set — knockout picks are open"}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-gray-300 text-sm font-medium block">
                Set new deadline (your local time)
              </label>
              <div className="flex gap-3 items-center flex-wrap">
                <input
                  type="datetime-local"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleSave}
                  disabled={saving || !deadlineInput}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm rounded font-medium transition-colors"
                >
                  {saving ? "Saving..." : "Set Deadline"}
                </button>
                {current && (
                  <button
                    onClick={handleClear}
                    disabled={saving}
                    className="px-5 py-2 bg-gray-700 hover:bg-red-900/60 disabled:opacity-50 text-gray-300 hover:text-red-300 text-sm rounded font-medium transition-colors"
                  >
                    Clear Deadline
                  </button>
                )}
              </div>
            </div>

            {message && (
              <p className={`text-sm ${message.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                {message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────
export default function Admin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("matches");
  const [groupResults, setGroupResults] = useState<Record<string, GroupResult>>({});
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersSearch, setUsersSearch] = useState("");
  const usersPerPage = 50;
  const [recalcResult, setRecalcResult] = useState<string>("");
  const [recalcLoading, setRecalcLoading] = useState(false);
  const recalcPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string>("");
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [bugsLoading, setBugsLoading] = useState(false);
  const [bugBackfillLoading, setBugBackfillLoading] = useState(false);
  const [bugBackfillResult, setBugBackfillResult] = useState<string>("");

  useEffect(() => {
    if (!loading && (!user || !user.is_admin)) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  async function loadGroupResults() {
    try {
      const results = await getGroupResults();
      const map: Record<string, GroupResult> = {};
      for (const r of results) map[r.group_code] = r;
      setGroupResults(map);
    } catch {
      // ignore
    }
  }

  async function loadUsers(page = 1, search = usersSearch) {
    setUsersLoading(true);
    try {
      const result = await getAdminUsers(page, usersPerPage, search);
      setAdminUsers(result.users);
      setUsersTotal(result.total);
      setUsersPage(result.page);
    } catch {
      setAdminUsers([]);
      setUsersTotal(0);
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    loadGroupResults();
  }, []);

  async function loadBugReports() {
    setBugsLoading(true);
    try {
      const reports = await getBugReports();
      setBugReports(reports);
    } catch {
      setBugReports([]);
    } finally {
      setBugsLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "users") { setUsersPage(1); loadUsers(1); }
    if (tab === "bugs") loadBugReports();
  }, [tab]);

  async function handleRecalculate() {
    if (recalcPollRef.current) clearTimeout(recalcPollRef.current);
    setRecalcLoading(true);
    setRecalcResult("Starting recalculation...");

    function poll() {
      recalcPollRef.current = setTimeout(async () => {
        try {
          const s = await getRecalculateStatus();
          if (s.status === "complete") {
            setRecalcResult(`✓ Recalculated scores for ${s.processed} users.`);
            setRecalcLoading(false);
          } else if (s.status === "error") {
            setRecalcResult(`Error: ${s.error ?? "Unknown error"}`);
            setRecalcLoading(false);
          } else {
            setRecalcResult("Recalculation running…");
            poll();
          }
        } catch {
          setRecalcResult("Error checking status — recalculation may still be running.");
          setRecalcLoading(false);
        }
      }, 3000);
    }

    try {
      await recalculate();
      poll();
    } catch (err: unknown) {
      setRecalcResult(err instanceof Error ? err.message : "Error starting recalculation");
      setRecalcLoading(false);
    }
  }

  async function handleBackfillLateEntries() {
    setBackfillLoading(true);
    setBackfillResult("");
    try {
      const result = await backfillLateEntries();
      setBackfillResult(`✓ Updated ${result.updated} account${result.updated !== 1 ? "s" : ""}.`);
    } catch (err: unknown) {
      setBackfillResult(err instanceof Error ? err.message : "Error running backfill");
    } finally {
      setBackfillLoading(false);
    }
  }

  async function handleBackfillBugReportDisplayNames() {
    setBugBackfillLoading(true);
    setBugBackfillResult("");
    try {
      const result = await backfillBugReportDisplayNames();
      setBugBackfillResult(`✓ Updated ${result.updated} of ${result.checked} report${result.checked !== 1 ? "s" : ""}.`);
      await loadBugReports();
    } catch (err: unknown) {
      setBugBackfillResult(err instanceof Error ? err.message : "Error running backfill");
    } finally {
      setBugBackfillLoading(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-emerald-400 animate-pulse">Loading...</div></div>;
  }
  if (!user?.is_admin) return null;

  const openBugCount = bugReports.filter((r) => r.status === "open").length;

  const tabs: Array<{ id: Tab; label: string; badge?: number }> = [
    { id: "matches", label: "Match Results" },
    { id: "groups", label: "Final Group Standings" },
    { id: "thirds", label: "Third-Place Teams" },
    { id: "knockout", label: "Knockout Results" },
    { id: "recalculate", label: "Recalculate" },
    { id: "users", label: "Users" },
    { id: "bugs", label: "Bug Reports", badge: openBugCount || undefined },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
        <p className="text-gray-400 mt-1">The Away End — World Cup 2026 Bracket Contest</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              tab === t.id
                ? "bg-emerald-700 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            {t.label}
            {t.badge != null && (
              <span className="bg-red-600 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
        {tab === "matches" && (
          <>
            <h2 className="text-xl font-bold text-white mb-4">Match Results</h2>
            <MatchResultsSection />
          </>
        )}

        {tab === "groups" && (
          <>
            <h2 className="text-xl font-bold text-white mb-4">Group Stage Results</h2>
            <GroupResultsSection groupResults={groupResults} onResultSaved={loadGroupResults} />
          </>
        )}

        {tab === "thirds" && (
          <>
            <h2 className="text-xl font-bold text-white mb-4">Third-Place Qualifiers</h2>
            <ThirdsResultSection onSaved={() => {}} />
          </>
        )}

        {tab === "knockout" && (
          <>
            <h2 className="text-xl font-bold text-white mb-4">Knockout Round Results</h2>
            <KnockoutResultSection onSaved={() => {}} />
          </>
        )}

        {tab === "recalculate" && (
          <>
            <h2 className="text-xl font-bold text-white mb-4">Recalculate Scores</h2>
            <p className="text-gray-400 text-sm mb-2">
              Run this after entering results to update all user scores and the leaderboard.
              Runs in the background — you can leave this page once it starts.
            </p>
            <p className="text-gray-500 text-xs mb-6">
              Only groups with official results entered will be scored. Provisional standings are not used.
            </p>
            <button
              onClick={handleRecalculate}
              disabled={recalcLoading}
              className="px-8 py-3 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-semibold text-lg transition-colors"
            >
              {recalcLoading ? "Running…" : "Recalculate All Scores"}
            </button>
            {recalcResult && (
              <p className={`mt-4 text-sm ${recalcResult.startsWith("✓") ? "text-emerald-400" : recalcResult.startsWith("Error") ? "text-red-400" : "text-gray-400"}`}>
                {recalcLoading && <span className="inline-block w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mr-2 align-middle" />}
                {recalcResult}
              </p>
            )}

            <hr className="border-gray-700 my-8" />

            <h3 className="text-lg font-semibold text-white mb-2">Backfill Late Entries</h3>
            <p className="text-gray-400 text-sm mb-4">
              Marks any account created after the picks deadline as a late entry. Safe to run multiple times — skips users already flagged.
            </p>
            <button
              onClick={handleBackfillLateEntries}
              disabled={backfillLoading}
              className="px-8 py-3 bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-semibold text-lg transition-colors"
            >
              {backfillLoading ? "Running…" : "Backfill Late Entries"}
            </button>
            {backfillResult && (
              <p className={`mt-4 text-sm ${backfillResult.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                {backfillResult}
              </p>
            )}
          </>
        )}

        {tab === "bugs" && (
          <>
            <h2 className="text-xl font-bold text-white mb-1">Bug Reports</h2>
            <p className="text-gray-400 text-sm mb-3">
              {bugReports.length} total — {openBugCount} open
            </p>
            <div className="mb-5">
              <button
                onClick={handleBackfillBugReportDisplayNames}
                disabled={bugBackfillLoading}
                className="px-4 py-2 bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
              >
                {bugBackfillLoading ? "Running…" : "Backfill Missing Names"}
              </button>
              {bugBackfillResult && (
                <p className={`mt-2 text-sm ${bugBackfillResult.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                  {bugBackfillResult}
                </p>
              )}
            </div>
            {bugsLoading ? (
              <div className="text-emerald-400 animate-pulse py-8 text-center">Loading...</div>
            ) : bugReports.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No bug reports yet.</p>
            ) : (
              <div className="space-y-3">
                {bugReports.map((report) => (
                  <BugReportRow
                    key={report.id}
                    report={report}
                    onStatusChange={async (status) => {
                      await updateBugReportStatus(report.id, status);
                      setBugReports((prev) =>
                        prev.map((r) => r.id === report.id ? { ...r, status } : r)
                      );
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "users" && (
          <>
            <div className="flex items-center justify-between mb-4 gap-4">
              <h2 className="text-xl font-bold text-white">
                Users
                {usersTotal > 0 && (
                  <span className="text-gray-400 font-normal text-base ml-2">({usersTotal} registered)</span>
                )}
              </h2>
              <input
                type="search"
                placeholder="Search by name or email..."
                value={usersSearch}
                onChange={(e) => {
                  const q = e.target.value;
                  setUsersSearch(q);
                  loadUsers(1, q);
                }}
                className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-3 py-1.5 w-64 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            {usersLoading ? (
              <div className="text-emerald-400 animate-pulse py-8 text-center">Loading users...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-700">
                        <th className="text-left py-2 pr-4 font-medium">Name</th>
                        <th className="text-left py-2 pr-4 font-medium">Email</th>
                        <th className="text-left py-2 pr-4 font-medium">ID</th>
                        <th className="text-center py-2 pr-4 font-medium">Admin</th>
                        <th className="text-left py-2 pr-4 font-medium">Created</th>
                        <th className="text-center py-2 pr-4 font-medium">Groups</th>
                        <th className="text-center py-2 pr-4 font-medium">Thirds</th>
                        <th className="text-center py-2 pr-4 font-medium">Bracket</th>
                        <th className="text-right py-2 pr-4 font-medium">Score</th>
                        <th className="text-center py-2 pr-4 font-medium">Pin</th>
                        <th className="text-center py-2 font-medium">Late Entry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {adminUsers.map((u) => (
                        <tr key={u.id} className={`text-gray-300 hover:bg-gray-800/40 ${u.is_pinned ? "bg-yellow-900/10" : ""} ${u.is_late_entry ? "bg-orange-900/10" : ""}`}>
                          <td className="py-2 pr-4">
                            {u.display_name}
                            {u.id === user.id && <span className="text-emerald-400 text-xs ml-2">(you)</span>}
                            {u.is_pinned && <span className="text-yellow-400 text-xs ml-2">📌 Host</span>}
                            {u.is_late_entry && <span className="text-orange-400 text-xs ml-2">⏰ Late</span>}
                          </td>
                          <td className="py-2 pr-4 text-gray-400 text-xs">{u.email}</td>
                          <td className="py-2 pr-4 text-gray-500 text-xs font-mono">{u.id}</td>
                          <td className="py-2 pr-4 text-center">
                            {u.is_admin ? <span className="text-emerald-400">✓</span> : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="py-2 pr-4 text-gray-400 text-xs whitespace-nowrap">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="py-2 pr-4 text-center">
                            {u.has_group_picks ? <span className="text-emerald-400">✓</span> : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="py-2 pr-4 text-center">
                            {u.has_thirds_picks ? <span className="text-emerald-400">✓</span> : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="py-2 pr-4 text-center">
                            {u.has_knockout_picks ? <span className="text-emerald-400">✓</span> : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="py-2 pr-4 text-right font-medium">{u.total_score}</td>
                          <td className="py-2 pr-4 text-center">
                            <button
                              onClick={async () => {
                                try {
                                  if (u.is_pinned) {
                                    await unpinUser(u.id);
                                  } else {
                                    await pinUser(u.id);
                                  }
                                  await loadUsers(usersPage);
                                } catch (err: unknown) {
                                  alert(err instanceof Error ? err.message : "Error");
                                }
                              }}
                              className={`text-xs px-2 py-1 rounded transition-colors ${
                                u.is_pinned
                                  ? "bg-yellow-800/60 text-yellow-300 hover:bg-yellow-800"
                                  : "bg-gray-700 text-gray-400 hover:text-yellow-300 hover:bg-gray-600"
                              }`}
                              title={u.is_pinned ? "Remove from Hosts" : "Pin as Host"}
                            >
                              {u.is_pinned ? "Unpin" : "Pin"}
                            </button>
                          </td>
                          <td className="py-2 text-center">
                            <button
                              onClick={async () => {
                                try {
                                  if (u.is_late_entry) {
                                    await unmarkLateEntry(u.id);
                                  } else {
                                    await markLateEntry(u.id);
                                  }
                                  await loadUsers(usersPage);
                                } catch (err: unknown) {
                                  alert(err instanceof Error ? err.message : "Error");
                                }
                              }}
                              className={`text-xs px-2 py-1 rounded transition-colors ${
                                u.is_late_entry
                                  ? "bg-orange-800/60 text-orange-300 hover:bg-orange-800"
                                  : "bg-gray-700 text-gray-400 hover:text-orange-300 hover:bg-gray-600"
                              }`}
                              title={u.is_late_entry ? "Remove late entry flag" : "Mark as late entry"}
                            >
                              {u.is_late_entry ? "Unmark" : "Mark"}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {adminUsers.length === 0 && (
                        <tr>
                          <td colSpan={11} className="py-8 text-center text-gray-500">No users yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {usersTotal > usersPerPage && (
                  <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
                    <span>
                      {(usersPage - 1) * usersPerPage + 1}–{Math.min(usersPage * usersPerPage, usersTotal)} of {usersTotal}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadUsers(usersPage - 1)}
                        disabled={usersPage <= 1}
                        className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => loadUsers(usersPage + 1)}
                        disabled={usersPage * usersPerPage >= usersTotal}
                        className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
        {tab === "settings" && (
          <>
            <h2 className="text-xl font-bold text-white mb-4">Settings</h2>
            <SettingsSection />
          </>
        )}
      </div>
    </div>
  );
}

function BugReportRow({
  report,
  onStatusChange,
}: {
  report: BugReport;
  onStatusChange: (status: "open" | "resolved") => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      await onStatusChange(report.status === "open" ? "resolved" : "open");
    } finally {
      setSaving(false);
    }
  }

  const date = new Date(report.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className={`border rounded-xl p-4 ${report.status === "resolved" ? "border-gray-700 opacity-60" : "border-gray-600"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${report.status === "open" ? "bg-red-900/60 text-red-300" : "bg-gray-700 text-gray-400"}`}>
              {report.status}
            </span>
            <span className="text-gray-500 text-xs">{date}</span>
            {report.display_name && (
              <span className="text-gray-400 text-xs">{report.display_name}</span>
            )}
            {report.page && (
              <span className="text-gray-500 text-xs font-mono bg-gray-800 px-1.5 py-0.5 rounded">{report.page}</span>
            )}
          </div>
          <p
            className={`text-gray-300 text-sm whitespace-pre-wrap cursor-pointer ${!expanded ? "line-clamp-2" : ""}`}
            onClick={() => setExpanded(!expanded)}
          >
            {report.description}
          </p>
          {report.description.length > 120 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-500 hover:text-gray-300 text-xs mt-1 transition-colors"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
            report.status === "open"
              ? "bg-emerald-800/60 text-emerald-300 hover:bg-emerald-700/60"
              : "bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200"
          }`}
        >
          {saving ? "…" : report.status === "open" ? "Resolve" : "Reopen"}
        </button>
      </div>
    </div>
  );
}
