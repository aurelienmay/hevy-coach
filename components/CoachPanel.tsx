"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { CoachReview } from "@/app/coach/page";
import type { ProposedTargetEdit } from "@/lib/coach";
import RoutineDraftCard from "@/components/RoutineDraftCard";

const REVIEW_MARKDOWN_STYLE: CSSProperties = { fontSize: 14, lineHeight: 1.5 };

const TARGET_STATUS_LABEL: Record<ProposedTargetEdit["status"], string> = {
  pending: "pending",
  applied: "applied ✓",
  rejected: "rejected",
};

function TargetEditRow({ reviewId, edit }: { reviewId: string; edit: ProposedTargetEdit }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "apply" | "reject") {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/target-edits", {
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
      <div style={{ fontWeight: 500, textTransform: "capitalize" }}>{edit.muscle} weekly target</div>
      <div style={{ color: "#999", margin: "4px 0" }}>
        {edit.currentMin}-{edit.currentMax} sets → {edit.newMin}-{edit.newMax} sets
      </div>
      <div style={{ color: "#666", fontStyle: "italic", marginBottom: 8 }}>{edit.rationale}</div>

      {edit.status === "pending" ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => act("apply")}
            disabled={pending}
            style={{ background: "#1f4d2e", color: "#9ee6ac", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}
          >
            Accept &amp; update target
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
          {TARGET_STATUS_LABEL[edit.status]}
        </span>
      )}
    </div>
  );
}

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p style={{ margin: "0 0 10px" }}>{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong style={{ fontWeight: 600, color: "#fff" }}>{children}</strong>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul style={{ margin: "0 0 10px", paddingLeft: 20 }}>{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol style={{ margin: "0 0 10px", paddingLeft: 20 }}>{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li style={{ marginBottom: 4 }}>{children}</li>,
  h1: ({ children }: { children?: React.ReactNode }) => <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{children}</h3>,
  h2: ({ children }: { children?: React.ReactNode }) => <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{children}</h3>,
  h3: ({ children }: { children?: React.ReactNode }) => <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>{children}</h4>,
};

function ReviewCard({ review }: { review: CoachReview }) {
  const [expanded, setExpanded] = useState(false);
  const routineIds = Array.from(new Set(review.proposed_edits.map((e) => e.routineId)));
  const pendingCount =
    routineIds.length +
    review.proposed_target_edits.filter((e) => e.status === "pending").length;

  return (
    <div style={{ background: "#14171b", border: "1px solid #23262b", borderRadius: 10, padding: 16 }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ color: "#ccc", fontSize: 13 }}>
          Week of {new Date(review.week_start).toLocaleDateString()}
          <span style={{ color: "#666", fontSize: 12 }}>
            {" "}
            — generated {new Date(review.created_at).toLocaleString()}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {pendingCount > 0 && (
            <span style={{ color: "#e6c56b", fontSize: 11 }}>{pendingCount} pending</span>
          )}
          <span style={{ color: "#666", fontSize: 12 }}>{expanded ? "▲ Hide" : "▼ Show"}</span>
        </div>
      </button>

      {expanded && (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...REVIEW_MARKDOWN_STYLE, marginBottom: routineIds.length || review.proposed_target_edits.length ? 16 : 0 }}>
            <ReactMarkdown components={markdownComponents}>{review.review}</ReactMarkdown>
          </div>

          {routineIds.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: review.proposed_target_edits.length ? 16 : 0 }}>
              {routineIds.map((routineId) => {
                const edits = review.proposed_edits.filter((e) => e.routineId === routineId);
                return (
                  <RoutineDraftCard
                    key={routineId}
                    reviewId={review.id}
                    routineId={routineId}
                    routineTitle={edits[0].routineTitle}
                    edits={edits}
                  />
                );
              })}
            </div>
          )}

          {review.proposed_target_edits.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ color: "#888", fontSize: 12 }}>Proposed weekly volume target changes</div>
              {review.proposed_target_edits.map((edit) => (
                <TargetEditRow key={edit.id} reviewId={review.id} edit={edit} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TAB_LABEL: Record<CoachReview["review_type"], string> = {
  performance: "Weekly reviews",
  plan: "Routines review",
};

const TABS: CoachReview["review_type"][] = ["performance", "plan"];

export default function CoachPanel({ initialReviews }: { initialReviews: CoachReview[] }) {
  const router = useRouter();
  const [generatingType, setGeneratingType] = useState<CoachReview["review_type"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CoachReview["review_type"]>("performance");

  const tabReviews = initialReviews.filter((r) => r.review_type === activeTab);

  async function generate(type: CoachReview["review_type"]) {
    setGeneratingType(type);
    setError(null);
    try {
      const endpoint = type === "plan" ? "/api/coach/routine-review" : "/api/coach/review";
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `request failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to generate review");
    } finally {
      setGeneratingType(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
        <button
          onClick={() => generate("performance")}
          disabled={generatingType !== null}
          style={{
            background: "#4f8ef7",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            cursor: generatingType ? "default" : "pointer",
          }}
        >
          {generatingType === "performance" ? "Analyzing your week…" : "Generate weekly review"}
        </button>
        <button
          onClick={() => generate("plan")}
          disabled={generatingType !== null}
          style={{
            background: "#2a2d33",
            color: "#e2e2e2",
            border: "1px solid #3a3d44",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            cursor: generatingType ? "default" : "pointer",
          }}
        >
          {generatingType === "plan" ? "Reviewing your routines…" : "Review my favorite routines"}
        </button>
      </div>
      {error && <div style={{ color: "#f56565", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "flex", gap: 4, marginTop: 20, borderBottom: "1px solid #23262b" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid #4f8ef7" : "2px solid transparent",
              color: activeTab === tab ? "#fff" : "#888",
              padding: "8px 14px",
              fontSize: 13,
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {TAB_LABEL[tab]}
            {initialReviews.filter((r) => r.review_type === tab).length > 0 &&
              ` (${initialReviews.filter((r) => r.review_type === tab).length})`}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        {tabReviews.length === 0 ? (
          <p style={{ color: "#888" }}>No {TAB_LABEL[activeTab].toLowerCase()} yet — generate one above.</p>
        ) : (
          tabReviews.map((r) => <ReviewCard key={r.id} review={r} />)
        )}
      </div>
    </div>
  );
}
