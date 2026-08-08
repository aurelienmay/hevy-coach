"use client";

import { useEffect, useMemo, useState } from "react";
import RoutineCard, { type Routine } from "@/components/RoutineCard";
import PlanVolumeSummary from "@/components/PlanVolumeSummary";
import { computePlanVolume } from "@/lib/planVolume";
import type { VolumeTargets } from "@/lib/currentUser";

export default function RoutineComparison({
  favorites,
  targets,
}: {
  favorites: Routine[];
  targets: VolumeTargets;
}) {
  const [candidates, setCandidates] = useState<Routine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch("/api/routines/others");
        if (!res.ok) throw new Error("failed to load");
        const { routines } = await res.json();
        if (!cancelled) setCandidates(routines);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function add(id: string) {
    setSelectedIds((prev) => new Set(prev).add(id));
    setPicking(false);
  }

  function remove(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const selected = useMemo(
    () => (candidates ?? []).filter((r) => selectedIds.has(r.id)),
    [candidates, selectedIds]
  );
  const pickable = useMemo(
    () => (candidates ?? []).filter((r) => !selectedIds.has(r.id)),
    [candidates, selectedIds]
  );

  const comparisonVolume = useMemo(() => computePlanVolume(selected), [selected]);
  const combinedVolume = useMemo(
    () => computePlanVolume([...favorites, ...selected]),
    [favorites, selected]
  );

  if (favorites.length === 0) return null;

  return (
    <>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Compare plan</h2>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setPicking((p) => !p)}
              style={{
                background: "none",
                border: "1px solid #333",
                borderRadius: 8,
                padding: "6px 12px",
                color: "#ccc",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              + Add routine
            </button>
            {picking && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 4px)",
                  background: "#14171b",
                  border: "1px solid #23262b",
                  borderRadius: 8,
                  padding: 6,
                  maxHeight: 260,
                  overflowY: "auto",
                  zIndex: 10,
                  minWidth: 220,
                }}
              >
                {loading && <p style={{ color: "#888", fontSize: 12, padding: 6 }}>Loading…</p>}
                {error && <p style={{ color: "#f56565", fontSize: 12, padding: 6 }}>Failed to load routines.</p>}
                {!loading && !error && pickable.length === 0 && (
                  <p style={{ color: "#888", fontSize: 12, padding: 6 }}>No more routines to add.</p>
                )}
                {pickable.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => add(r.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 8px",
                      color: "#ccc",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1c1f23")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    {r.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selected.length === 0 ? (
          <p style={{ color: "#888", fontSize: 13, marginBottom: 24 }}>
            Add routines to build a second plan and compare its weekly volume against your current one.
          </p>
        ) : (
          <>
            <PlanVolumeSummary
              volume={comparisonVolume}
              targets={targets}
              title="Compare plan volume"
              description="Working sets per muscle across the routines added to this comparison, vs. a typical weekly target."
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 16,
              }}
            >
              {selected.map((r) => (
                <div key={r.id} style={{ position: "relative" }}>
                  <RoutineCard routine={r} />
                  <button
                    onClick={() => remove(r.id)}
                    aria-label="Remove from comparison"
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 44,
                      background: "none",
                      border: "none",
                      color: "#666",
                      fontSize: 16,
                      cursor: "pointer",
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {selected.length > 0 && (
        <div style={{ gridColumn: "1 / -1" }}>
          <PlanVolumeSummary
            volume={combinedVolume}
            targets={targets}
            title="Combined weekly volume"
            description="Current plan + compare plan combined — use this to see how well both together hit your weekly set goals."
          />
        </div>
      )}
    </>
  );
}
