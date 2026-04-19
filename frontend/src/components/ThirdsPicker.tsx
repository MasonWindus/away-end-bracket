import React from "react";

interface ThirdTeam {
  code: string;
  name: string;
  group: string;
}

interface ThirdsPickerProps {
  thirdPlaceTeams: ThirdTeam[];
  selected: string[];
  onChange: (teams: string[]) => void;
  locked: boolean;
}

export default function ThirdsPicker({ thirdPlaceTeams, selected, onChange, locked }: ThirdsPickerProps) {
  const MAX_SELECTED = 8;

  function toggle(code: string) {
    if (locked) return;
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      if (selected.length < MAX_SELECTED) {
        onChange([...selected, code]);
      }
    }
  }

  const count = selected.length;
  const isMaxed = count >= MAX_SELECTED;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-white font-bold text-base">
          Select 8 Third-Place Teams to Advance
        </h3>
        <div
          className={`px-3 py-1.5 rounded-full text-sm font-bold ${
            count === MAX_SELECTED
              ? "bg-emerald-600 text-white"
              : "bg-gray-700 text-gray-300"
          }`}
        >
          {count} / {MAX_SELECTED} selected
        </div>
      </div>

      {locked && (
        <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-3 py-2">
          <span className="text-yellow-500 text-sm">Picks are locked — viewing read-only.</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            count === MAX_SELECTED ? "bg-emerald-500" : "bg-emerald-700"
          }`}
          style={{ width: `${(count / MAX_SELECTED) * 100}%` }}
        />
      </div>

      {/* Team grid */}
      {thirdPlaceTeams.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">Complete your group picks first to see third-place teams.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {thirdPlaceTeams.map((team) => {
            const isSelected = selected.includes(team.code);
            const isDisabled = locked || (!isSelected && isMaxed);

            return (
              <button
                key={team.code}
                onClick={() => toggle(team.code)}
                disabled={isDisabled}
                className={`relative p-3 rounded-xl border text-left transition-all duration-150 ${
                  isSelected
                    ? "bg-emerald-700/40 border-emerald-500 text-white shadow-lg shadow-emerald-900/30"
                    : isDisabled
                    ? "bg-gray-800/50 border-gray-700 text-gray-600 cursor-not-allowed"
                    : "bg-gray-800 border-gray-600 text-gray-300 hover:border-emerald-600 hover:bg-gray-750 cursor-pointer"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                <div className="pr-6">
                  <div className="text-xs font-bold text-emerald-400 mb-0.5">
                    Group {team.group}
                  </div>
                  <div className="text-sm font-semibold leading-tight">
                    {team.name}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{team.code}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Helper text */}
      {!locked && count < MAX_SELECTED && thirdPlaceTeams.length > 0 && (
        <p className="text-gray-500 text-xs text-center">
          Select {MAX_SELECTED - count} more team{MAX_SELECTED - count !== 1 ? "s" : ""}
        </p>
      )}
      {!locked && count === MAX_SELECTED && (
        <p className="text-emerald-400 text-xs text-center font-medium">
          ✓ All 8 advancing third-place teams selected
        </p>
      )}
    </div>
  );
}
