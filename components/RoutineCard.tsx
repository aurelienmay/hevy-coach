"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { muscleFor } from "@/lib/muscleMap";
import type { HevyExercise, HevyRoutine, HevySet } from "@/lib/hevy";

const MUSCLE_COLORS: Record<string, string> = {
  back: "#4f8ef7",
  shoulders: "#f7b84f",
  biceps: "#68d391",
  triceps: "#63b3ed",
  chest: "#f56565",
  quads: "#b794f4",
  hamstrings: "#ed8936",
  calves: "#a0aec0",
  glutes: "#f687b3",
  forearms: "#718096",
  abs: "#4fd1c5",
  lower_back: "#ecc94b",
  cardio: "#4fd1c5",
  other: "#666",
};

export type RoutineSet = HevySet;
export type RoutineExercise = HevyExercise;

export type Routine = HevyRoutine & { is_favorite: boolean; is_adapted_plan?: boolean; is_compare_plan?: boolean };

function formatSet(s: RoutineSet): string {
  if (s.duration_seconds) return `${Math.round(s.duration_seconds / 60)} min`;
  if (s.distance_meters) return `${(s.distance_meters / 1000).toFixed(1)} km`;
  if (s.weight_kg && s.reps) return `${s.weight_kg}kg × ${s.reps}`;
  if (s.reps) return `${s.reps} reps`;
  return "—";
}

export default function RoutineCard({ routine, compact = false }: { routine: Routine; compact?: boolean }) {
  const router = useRouter();
  const [favorite, setFavorite] = useState(routine.is_favorite);
  const [favoritePending, setFavoritePending] = useState(false);
  const [adapted, setAdapted] = useState(routine.is_adapted_plan ?? false);
  const [adaptedPending, setAdaptedPending] = useState(false);
  const [compare, setCompare] = useState(routine.is_compare_plan ?? false);
  const [comparePending, setComparePending] = useState(false);

  async function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    setFavoritePending(true);
    try {
      await fetch(`/api/routines/${routine.id}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: next }),
      });
      router.refresh();
    } catch {
      setFavorite(!next);
    } finally {
      setFavoritePending(false);
    }
  }

  async function toggleAdapted() {
    const next = !adapted;
    setAdapted(next);
    setAdaptedPending(true);
    try {
      await fetch(`/api/routines/${routine.id}/adapted-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adapted: next }),
      });
      router.refresh();
    } catch {
      setAdapted(!next);
    } finally {
      setAdaptedPending(false);
    }
  }

  async function toggleCompare() {
    const next = !compare;
    setCompare(next);
    setComparePending(true);
    try {
      await fetch(`/api/routines/${routine.id}/compare-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compare: next }),
      });
      router.refresh();
    } catch {
      setCompare(!next);
    } finally {
      setComparePending(false);
    }
  }

  const exercises = [...(routine.exercises ?? [])].sort((a, b) => a.index - b.index);

  const starButton = (
    <button
      onClick={toggleFavorite}
      disabled={favoritePending}
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      style={{
        background: "none",
        border: "none",
        cursor: favoritePending ? "default" : "pointer",
        fontSize: 18,
        color: favorite ? "#f7b84f" : "#444",
        lineHeight: 1,
        padding: 0,
      }}
    >
      {favorite ? "★" : "☆"}
    </button>
  );

  // Marks a routine as part of the AI Coach's reusable adaptation pool --
  // same toggle mechanic as favoriting, just a separate tag (a routine can be
  // both, either, or neither). See app/api/coach/week-plan/push/route.ts.
  const adaptButton = (
    <button
      onClick={toggleAdapted}
      disabled={adaptedPending}
      aria-label={adapted ? "Remove from adaptation pool" : "Add to adaptation pool"}
      title={adapted ? "In the AI Coach's adaptation pool" : "Add to the AI Coach's adaptation pool"}
      style={{
        background: "none",
        border: "none",
        cursor: adaptedPending ? "default" : "pointer",
        fontSize: 16,
        color: adapted ? "#4f8ef7" : "#444",
        lineHeight: 1,
        padding: 0,
      }}
    >
      ⟳
    </button>
  );

  // Marks a routine as tagged into the "compare plan" set shown alongside
  // the current plan for a volume comparison -- same toggle mechanic again,
  // a fully independent tag. See components/RoutineComparison.tsx.
  const compareButton = (
    <button
      onClick={toggleCompare}
      disabled={comparePending}
      aria-label={compare ? "Remove from compare plan" : "Add to compare plan"}
      title={compare ? "In the compare plan" : "Add to the compare plan"}
      style={{
        background: "none",
        border: "none",
        cursor: comparePending ? "default" : "pointer",
        fontSize: 15,
        color: compare ? "#68d391" : "#444",
        lineHeight: 1,
        padding: 0,
      }}
    >
      ⚖
    </button>
  );

  if (compact) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#14171b",
          border: "1px solid #23262b",
          borderRadius: 8,
          padding: "10px 14px",
        }}
      >
        <span style={{ fontSize: 14 }}>{routine.title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {compareButton}
          {adaptButton}
          {starButton}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#14171b", border: "1px solid #23262b", borderRadius: 10, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>{routine.title}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {compareButton}
          {adaptButton}
          {starButton}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {exercises.map((ex) => {
          const muscle = muscleFor(ex.title);
          const workingSets = ex.sets.filter((s) => s.type !== "warmup");
          return (
            <div key={ex.index} style={{ fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: MUSCLE_COLORS[muscle] ?? "#666",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 500 }}>{ex.title}</span>
                <span style={{ color: "#666", fontSize: 11 }}>{muscle}</span>
              </div>
              <div style={{ color: "#999", marginLeft: 14 }}>
                {workingSets.length === 0
                  ? "no working sets"
                  : `${workingSets.length} sets — ${workingSets.map(formatSet).join(", ")}`}
              </div>
              {ex.notes && (
                <div style={{ color: "#666", marginLeft: 14, fontStyle: "italic" }}>{ex.notes}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
