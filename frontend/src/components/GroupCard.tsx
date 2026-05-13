import React, { useState, useEffect } from "react";
import type { GroupPick } from "../types";

interface Team {
  code: string;
  name: string;
}

interface GroupCardProps {
  groupCode: string;
  teams: Team[];
  picks: GroupPick | null;
  onSave: (pick: Omit<GroupPick, "group_code" | "locked">) => Promise<void>;
  locked: boolean;
}

const POSITIONS = ["first_place", "second_place", "third_place", "fourth_place"] as const;
const POSITION_LABELS = ["1st Place", "2nd Place", "3rd Place", "4th Place"];

export default function GroupCard({ groupCode, teams, picks, onSave, locked }: GroupCardProps) {
  const initialOrder: [string, string, string, string] = picks
    ? [picks.first_place, picks.second_place, picks.third_place, picks.fourth_place]
    : ["", "", "", ""];

  const [order, setOrder] = useState<[string, string, string, string]>(initialOrder);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync if parent picks change (e.g., on load)
  useEffect(() => {
    if (picks) {
      setOrder([picks.first_place, picks.second_place, picks.third_place, picks.fourth_place]);
    }
  }, [picks]);

  function handleChange(posIndex: number, value: string) {
    if (locked) return;
    setSaved(false);
    setError(null);
    const newOrder = [...order] as [string, string, string, string];
    // If this team is already in another slot, swap
    const existingIdx = newOrder.findIndex((v, i) => i !== posIndex && v === value);
    if (existingIdx !== -1) {
      newOrder[existingIdx] = newOrder[posIndex];
    }
    newOrder[posIndex] = value;
    setOrder(newOrder);
  }

  async function handleSave() {
    setError(null);
    if (order.some((v) => !v)) {
      setError("Please select a team for every position.");
      return;
    }
    const unique = new Set(order);
    if (unique.size !== 4) {
      setError("Each team must appear in exactly one position.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        first_place: order[0],
        second_place: order[1],
        third_place: order[2],
        fourth_place: order[3],
      });
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const isComplete = order.every(Boolean) && new Set(order).size === 4;

  return (
    <div
      className={`bg-away-green border rounded-xl p-4 flex flex-col gap-3 transition-colors ${
        locked ? "border-away-moss opacity-80" : isComplete ? "border-away-gold/50" : "border-away-moss"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-away-gold font-bold text-sm uppercase tracking-widest">
          Group {groupCode}
        </h3>
        {saved && !locked && (
          <span className="flex items-center gap-1 text-away-gold text-xs font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        )}
        {locked && (
          <span className="text-yellow-500 text-xs font-medium flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            Locked
          </span>
        )}
      </div>

      {/* Dropdowns */}
      <div className="space-y-2">
        {POSITIONS.map((_, posIdx) => (
          <div key={posIdx} className="flex items-center gap-2">
            <span className="text-away-cream/50 text-xs font-medium w-16 shrink-0">
              {POSITION_LABELS[posIdx]}
            </span>
            {locked ? (
              <div className="flex-1 bg-away-forest border border-away-moss rounded-lg px-3 py-2 text-sm text-away-cream/80">
                {teams.find((t) => t.code === order[posIdx])?.name || (
                  <span className="text-away-cream/30 italic">Not set</span>
                )}
              </div>
            ) : (
              <select
                value={order[posIdx]}
                onChange={(e) => handleChange(posIdx, e.target.value)}
                className="flex-1 bg-away-forest border border-away-moss rounded-lg px-3 py-2 text-sm text-away-cream focus:outline-none focus:border-away-gold focus:ring-1 focus:ring-away-gold cursor-pointer"
              >
                <option value="">-- Select team --</option>
                {teams.map((team) => (
                  <option key={team.code} value={team.code}>
                    {team.name} ({team.code})
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-xs mt-1">{error}</p>
      )}

      {/* Save button */}
      {!locked && (
        <button
          onClick={handleSave}
          disabled={saving || !isComplete}
          className={`mt-1 w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
            isComplete
              ? "bg-away-gold hover:bg-away-gold-light text-away-forest"
              : "bg-away-moss text-away-cream/30 cursor-not-allowed"
          } disabled:opacity-60`}
        >
          {saving ? "Saving..." : saved ? "✓ Saved" : "Save Group"}
        </button>
      )}
    </div>
  );
}
