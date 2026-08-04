"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CoachReview } from "@/app/coach/page";
import type { ProposedEdit } from "@/lib/coach";

const STATUS_LABEL: Record<ProposedEdit["status"], string> = {
  pending: "pending",
  applied: "applied ✓",
  rejected: "rejected",
};

function EditRow({ reviewId, edit }: { reviewId: string; edit: ProposedEdit }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "apply" | "reject") {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/edits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, editId: edit.id, action }),
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
    <div style={{ border: "1px solid #23262b", borderRadius: 8, padding: 12, fontSize: 13 }}>
      <div style={{ fontWeight: 500 }}>
        {edit.routineTitle} — {edit.exerciseTitle}
      </div>
      <div style={{ color: "#999", margin: "4px 0" }}>
        {edit.action === "add_set" ? `Add ${edit.count} set(s)` : `Remove ${edit.count} set(s)`}
      </div>
      <div style={{ color: "#666", fontStyle: "italic", marginBottom: 8 }}>{edit.rationale}</div>

      {edit.status === "pending" ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => act("apply")}
            disabled={pending}
            style={{ background: "#1f4d2e", color: "#9ee6ac", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}
          >
            Accept &amp; apply to Hevy
          </button>
          <button
            onClick={() => act("reject")}
            disabled={pending}
            style={{ background: "#2a2d33", color: "#ccc", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}
          >
            Reject
          </button>
          {error && <span style={{ color: "#f56565", fontSize: 12 }}>{error}</span>}
        </div>
      ) : (
        <span style={{ color: edit.status === "applied" ? "#68d391" : "#888", fontSize: 12 }}>
          {STATUS_LABEL[edit.status]}
        </span>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: CoachReview }) {
  return (
    <div style={{ background: "#14171b", border: "1px solid #23262b", borderRadius: 10, padding: 16 }}>
      <div style={{ color: "#888", fontSize: 12, marginBottom: 10 }}>
        Generated {new Date(review.created_at).toLocaleString()} — week of {new Date(review.week_start).toLocaleDateString()}
      </div>
      <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5, marginBottom: review.proposed_edits.length ? 16 : 0 }}>
        {review.review}
      </div>
      {review.proposed_edits.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {review.proposed_edits.map((edit) => (
            <EditRow key={edit.id} reviewId={review.id} edit={edit} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CoachPanel({ initialReviews }: { initialReviews: CoachReview[] }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/review", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `request failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to generate review");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <button
        onClick={generate}
        disabled={generating}
        style={{
          background: "#4f8ef7",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "10px 18px",
          fontSize: 14,
          cursor: generating ? "default" : "pointer",
          marginBottom: 8,
        }}
      >
        {generating ? "Analyzing your week…" : "Generate weekly review"}
      </button>
      {error && <div style={{ color: "#f56565", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
        {initialReviews.length === 0 ? (
          <p style={{ color: "#888" }}>No reviews yet — generate your first one above.</p>
        ) : (
          initialReviews.map((r) => <ReviewCard key={r.id} review={r} />)
        )}
      </div>
    </div>
  );
}
