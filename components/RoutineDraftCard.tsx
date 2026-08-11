"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProposedEdit } from "@/lib/coach";

const ACTION_LABEL: Record<ProposedEdit["action"], string> = {
  add_set: "add set(s)",
  remove_set: "remove set(s)",
  change_weight: "change weight",
  change_rest_seconds: "change rest",
};

type ExerciseAfter = { workingSets: number; topWeightKg: number | null; restSeconds: number | null };

// Applies this exercise's pending edits, in order, on top of its `before`
// snapshot — pure arithmetic, no Hevy call needed just to render the diff.
function computeAfter(edits: ProposedEdit[]): ExerciseAfter {
  const after: ExerciseAfter = { ...edits[0].before };
  for (const edit of edits) {
    if (edit.action === "add_set") after.workingSets += edit.count ?? 0;
    else if (edit.action === "remove_set") after.workingSets = Math.max(0, after.workingSets - (edit.count ?? 0));
    else if (edit.action === "change_weight" && edit.newWeightKg != null) after.topWeightKg = edit.newWeightKg;
    else if (edit.action === "change_rest_seconds" && edit.newRestSeconds != null) after.restSeconds = edit.newRestSeconds;
  }
  return after;
}

function formatWeight(kg: number | null): string {
  return kg == null ? "—" : `${kg}kg`;
}

function formatRest(s: number | null): string {
  return s == null ? "—" : `${s}s`;
}

function ExerciseDiffRow({ edits }: { edits: ProposedEdit[] }) {
  const before = edits[0].before;
  const after = computeAfter(edits);
  const changed = {
    sets: before.workingSets !== after.workingSets,
    weight: before.topWeightKg !== after.topWeightKg,
    rest: before.restSeconds !== after.restSeconds,
  };

  return (
    <div style={{ padding: "8px 0", borderTop: "1px solid var(--border-default)" }}>
      <div style={{ fontWeight: 500, marginBottom: 4 }}>{edits[0].exerciseTitle}</div>
      <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--text-secondary)" }}>
        <span style={{ color: changed.sets ? "var(--warning)" : "var(--text-secondary)" }}>
          {before.workingSets} → {after.workingSets} sets
        </span>
        <span style={{ color: changed.weight ? "var(--warning)" : "var(--text-secondary)" }}>
          {formatWeight(before.topWeightKg)} → {formatWeight(after.topWeightKg)}
        </span>
        <span style={{ color: changed.rest ? "var(--warning)" : "var(--text-secondary)" }}>
          rest {formatRest(before.restSeconds)} → {formatRest(after.restSeconds)}
        </span>
      </div>
      <ul style={{ margin: "4px 0 0 16px", padding: 0, color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>
        {edits.map((e) => (
          <li key={e.id}>
            {ACTION_LABEL[e.action]} — {e.rationale}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RoutineDraftCard({
  reviewId,
  routineId,
  routineTitle,
  edits,
}: {
  reviewId: string;
  routineId: string;
  routineTitle: string;
  edits: ProposedEdit[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byExercise = new Map<number, ProposedEdit[]>();
  for (const edit of edits) {
    if (!byExercise.has(edit.exerciseIndex)) byExercise.set(edit.exerciseIndex, []);
    byExercise.get(edit.exerciseIndex)!.push(edit);
  }

  const status = edits[0].status;

  async function act(action: "apply" | "reject") {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/edits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, routineId, action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `request failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card-nested" style={{ fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{routineTitle}</div>
        {status === "pending" ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => act("apply")} disabled={pending} className="btn btn-sm btn-success">
              Accept draft &amp; apply to Hevy
            </button>
            <button onClick={() => act("reject")} disabled={pending} className="btn btn-sm btn-neutral">
              Discard draft
            </button>
          </div>
        ) : (
          <span style={{ color: status === "applied" ? "var(--success)" : "var(--text-secondary)", fontSize: 12 }}>
            {status === "applied" ? "applied ✓" : "discarded"}
          </span>
        )}
      </div>
      {error && <div style={{ color: "var(--error)", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      <div>
        {Array.from(byExercise.values()).map((exerciseEdits) => (
          <ExerciseDiffRow key={exerciseEdits[0].exerciseIndex} edits={exerciseEdits} />
        ))}
      </div>
    </div>
  );
}
