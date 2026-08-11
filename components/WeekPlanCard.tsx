"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlannedDay } from "@/lib/coach";

function DayRow({ reviewId, day }: { reviewId: string; day: PlannedDay }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function push() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/week-plan/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, date: day.date }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `request failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to push to Hevy");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card-nested">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>
            {day.weekday} · {day.date}
          </div>
          <div style={{ color: day.status === "train" ? "var(--accent-text-on-bg)" : "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>
            {day.status === "train" ? day.sessionTitle : "Rest"}
          </div>
        </div>
        {day.status === "train" && day.exercises.length > 0 && (
          day.hevyRoutineId ? (
            <span style={{ color: "var(--success)", fontSize: 12 }}>Created in Hevy ✓</span>
          ) : (
            <button onClick={push} disabled={pending} className="btn btn-sm btn-success" style={{ whiteSpace: "nowrap" }}>
              {pending ? "Pushing…" : "Push to Hevy"}
            </button>
          )
        )}
      </div>

      {day.status === "train" && day.exercises.length > 0 && (
        <ul style={{ margin: "6px 0", paddingLeft: 18, fontSize: 13, color: "var(--text-primary)" }}>
          {day.exercises.map((ex, i) => (
            <li key={i} style={{ marginBottom: 2 }}>
              {ex.exerciseTitle} ({ex.muscle}) — {ex.workingSets} sets
              {ex.weightKg != null ? ` @ ${ex.weightKg}kg` : ""}
              {ex.reps != null ? ` x ${ex.reps}` : ""}
            </li>
          ))}
        </ul>
      )}

      {day.rationale && <div style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 12 }}>{day.rationale}</div>}
      {error && <div style={{ color: "var(--error)", fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}

export default function WeekPlanCard({ reviewId, days }: { reviewId: string; days: PlannedDay[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {days.map((day) => (
        <DayRow key={day.date} reviewId={reviewId} day={day} />
      ))}
    </div>
  );
}
