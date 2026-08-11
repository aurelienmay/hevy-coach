"use client";

import { useState } from "react";
import RoutineCard, { type Routine } from "@/components/RoutineCard";

export default function OtherRoutines() {
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function loadOthers() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/routines/others");
      if (!res.ok) throw new Error("failed to load");
      const { routines: others } = await res.json();
      setRoutines(others);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (routines === null) {
    return (
      <button onClick={loadOthers} disabled={loading} className="btn btn-neutral">
        {loading ? "Loading…" : error ? "Failed to load — try again" : "Show other routines to add a favorite"}
      </button>
    );
  }

  if (routines.length === 0) {
    return <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No other routines.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {routines.map((r) => (
        <RoutineCard key={r.id} routine={r} compact />
      ))}
    </div>
  );
}
