"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { CoachReview } from "@/app/coach/page";
import type { ProposedTargetEdit } from "@/lib/coach";
import RoutineDraftCard from "@/components/RoutineDraftCard";
import WeekPlanCard from "@/components/WeekPlanCard";
import { startOfWeek, addWeeks } from "@/lib/workoutStats";

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
    <div className="card-nested" style={{ fontSize: 13 }}>
      <div style={{ fontWeight: 500, textTransform: "capitalize" }}>{edit.muscle} weekly target</div>
      <div style={{ color: "var(--text-secondary)", margin: "4px 0" }}>
        {edit.currentMin}-{edit.currentMax} sets → {edit.newMin}-{edit.newMax} sets
      </div>
      <div style={{ color: "var(--text-muted)", fontStyle: "italic", marginBottom: 8 }}>{edit.rationale}</div>

      {edit.status === "pending" ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => act("apply")} disabled={pending} className="btn btn-sm btn-success">
            Accept &amp; update target
          </button>
          <button onClick={() => act("reject")} disabled={pending} className="btn btn-sm btn-neutral">
            Reject
          </button>
          {error && <span style={{ color: "var(--error)", fontSize: 12 }}>{error}</span>}
        </div>
      ) : (
        <span style={{ color: edit.status === "applied" ? "var(--success)" : "var(--text-secondary)", fontSize: 12 }}>
          {TARGET_STATUS_LABEL[edit.status]}
        </span>
      )}
    </div>
  );
}

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p style={{ margin: "0 0 10px" }}>{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong style={{ fontWeight: 600, color: "var(--text-heading)" }}>{children}</strong>,
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
  const unpushedDays = review.week_plan.filter((d) => d.status === "train" && d.exercises.length > 0 && !d.hevyRoutineId);
  const pendingCount =
    review.review_type === "week_plan"
      ? unpushedDays.length
      : routineIds.length + review.proposed_target_edits.filter((e) => e.status === "pending").length;

  return (
    <div className="card">
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
        <div style={{ color: "var(--text-primary)", fontSize: 13 }}>
          Week of {new Date(review.week_start).toLocaleDateString()}
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
            {" "}
            — generated {new Date(review.created_at).toLocaleString()}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {pendingCount > 0 && (
            <span style={{ color: "var(--warning-text)", fontSize: 11 }}>{pendingCount} pending</span>
          )}
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{expanded ? "▲ Hide" : "▼ Show"}</span>
        </div>
      </button>

      {expanded && (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...REVIEW_MARKDOWN_STYLE, marginBottom: routineIds.length || review.proposed_target_edits.length ? 16 : 0 }}>
            <ReactMarkdown components={markdownComponents}>{review.review}</ReactMarkdown>
          </div>

          {review.review_type === "week_plan" ? (
            <WeekPlanCard reviewId={review.id} days={review.week_plan} />
          ) : (
            <>
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
                  <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>Proposed weekly volume target changes</div>
                  {review.proposed_target_edits.map((edit) => (
                    <TargetEditRow key={edit.id} reviewId={review.id} edit={edit} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const TAB_LABEL: Record<CoachReview["review_type"], string> = {
  performance: "Weekly reviews",
  plan: "Routines review",
  week_plan: "Adapted week plans",
};

const TABS: CoachReview["review_type"][] = ["performance", "plan", "week_plan"];

// Next Monday's date (YYYY-MM-DD), the sensible default target for "plan an
// upcoming week" -- today's own week is already underway. Built from local
// date components rather than toISOString(), which would shift the date by
// the browser's UTC offset and could land on the wrong calendar day.
function nextMondayInputDefault(): string {
  const monday = addWeeks(startOfWeek(), 1);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function CoachPanel({ initialReviews }: { initialReviews: CoachReview[] }) {
  const router = useRouter();
  const [generatingType, setGeneratingType] = useState<CoachReview["review_type"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CoachReview["review_type"]>("performance");
  const [weekStartInput, setWeekStartInput] = useState(nextMondayInputDefault);

  const tabReviews = initialReviews.filter((r) => r.review_type === activeTab);

  async function generate(type: "performance" | "plan") {
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

  async function generateWeekPlan() {
    setGeneratingType("week_plan");
    setError(null);
    try {
      const res = await fetch("/api/coach/week-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: weekStartInput }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `request failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to generate week plan");
    } finally {
      setGeneratingType(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
        <button onClick={() => generate("performance")} disabled={generatingType !== null} className="btn btn-primary">
          {generatingType === "performance" ? "Analyzing your week…" : "Generate weekly review"}
        </button>
        <button onClick={() => generate("plan")} disabled={generatingType !== null} className="btn btn-neutral">
          {generatingType === "plan" ? "Reviewing your routines…" : "Review my favorite routines"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <label style={{ color: "var(--text-secondary)", fontSize: 12 }}>
          Plan the week of{" "}
          <input
            type="date"
            value={weekStartInput}
            onChange={(e) => setWeekStartInput(e.target.value)}
            className="input"
            style={{ width: "auto", display: "inline-block", padding: "6px 8px", fontSize: 13, marginLeft: 6 }}
          />
        </label>
        <button
          onClick={generateWeekPlan}
          disabled={generatingType !== null || !weekStartInput}
          className="btn btn-neutral btn-sm"
        >
          {generatingType === "week_plan" ? "Adapting your week…" : "Adapt this week's plan"}
        </button>
      </div>
      {error && <div style={{ color: "var(--error)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "flex", gap: 4, marginTop: 20, borderBottom: "1px solid var(--border-default)" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === tab ? "var(--text-heading)" : "var(--text-secondary)",
              padding: "8px 14px",
              fontSize: 13,
              cursor: "pointer",
              marginBottom: -1,
              transition: "color var(--transition-fast), border-color var(--transition-fast)",
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
          <p style={{ color: "var(--text-secondary)" }}>No {TAB_LABEL[activeTab].toLowerCase()} yet — generate one above.</p>
        ) : (
          tabReviews.map((r) => <ReviewCard key={r.id} review={r} />)
        )}
      </div>
    </div>
  );
}
