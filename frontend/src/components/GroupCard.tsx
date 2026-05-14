import React, { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { GroupPick } from "../types";
import TeamFlag from "./TeamFlag";

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

const POSITION_LABELS = ["1st", "2nd", "3rd", "4th"];

function SortableTeamRow({ team, index, locked }: { team: Team; index: number; locked: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: team.code,
    disabled: locked,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg px-2 py-2 border transition-colors select-none ${
        isDragging
          ? "bg-away-gold/20 border-away-gold shadow-lg z-10 relative"
          : "bg-away-forest border-away-moss"
      } ${locked ? "opacity-80" : ""}`}
    >
      <span className="text-away-cream/40 text-xs font-bold w-7 shrink-0 text-right">
        {POSITION_LABELS[index]}
      </span>
      <span className="flex-1 text-sm text-away-cream truncate flex items-center gap-1.5">
        <TeamFlag code={team.code} />
        <span className="truncate">{team.name}</span>
      </span>
      {!locked && (
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-away-cream/30 hover:text-away-cream/70 cursor-grab active:cursor-grabbing touch-none"
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function GroupCard({ groupCode, teams, picks, onSave, locked }: GroupCardProps) {
  function initialOrder(): Team[] {
    if (picks?.first_place) {
      const codes = [picks.first_place, picks.second_place, picks.third_place, picks.fourth_place];
      return codes.map((c) => teams.find((t) => t.code === c)!).filter(Boolean);
    }
    return [...teams];
  }

  const [order, setOrder] = useState<Team[]>(initialOrder);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!picks?.first_place);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (picks?.first_place) {
      const codes = [picks.first_place, picks.second_place, picks.third_place, picks.fourth_place];
      setOrder(codes.map((c) => teams.find((t) => t.code === c)!).filter(Boolean));
      setSaved(true);
      setDirty(false);
    }
  }, [picks, teams]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIdx = prev.findIndex((t) => t.code === active.id);
      const newIdx = prev.findIndex((t) => t.code === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
    setDirty(true);
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await onSave({
        first_place: order[0].code,
        second_place: order[1].code,
        third_place: order[2].code,
        fourth_place: order[3].code,
      });
      setSaved(true);
      setDirty(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const isComplete = order.length === 4;
  const showSavePrompt = isComplete && (dirty || !saved);

  return (
    <div
      className={`bg-away-green border rounded-xl p-4 flex flex-col gap-3 transition-colors ${
        locked ? "border-away-moss opacity-80" : saved && !dirty ? "border-away-gold/50" : "border-away-moss"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-away-gold font-bold text-sm uppercase tracking-widest">
          Group {groupCode}
        </h3>
        {saved && !dirty && !locked && (
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

      {/* Sortable list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order.map((t) => t.code)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
            {order.map((team, idx) => (
              <SortableTeamRow key={team.code} team={team} index={idx} locked={locked} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!locked && (
        <p className="text-away-cream/30 text-xs text-center">
          Drag to reorder
        </p>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {!locked && (
        <button
          onClick={handleSave}
          disabled={saving || !showSavePrompt}
          className={`mt-1 w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
            showSavePrompt
              ? "bg-away-gold hover:bg-away-gold-light text-away-forest"
              : "bg-away-moss text-away-cream/30 cursor-not-allowed"
          } disabled:opacity-60`}
        >
          {saving ? "Saving..." : saved && !dirty ? "✓ Saved" : "Save Group"}
        </button>
      )}
    </div>
  );
}
