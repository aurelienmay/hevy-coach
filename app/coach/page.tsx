import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCoachApiKeys, getTrainingProfile } from "@/lib/currentUser";
import { GOAL_LABELS, EXPERIENCE_LABELS } from "@/lib/trainingProfile";
import CoachPanel from "@/components/CoachPanel";
import type { ProposedEdit, ProposedTargetEdit, PlannedDay } from "@/lib/coach";

export const dynamic = "force-dynamic";

export type CoachReview = {
  id: string;
  week_start: string;
  review_type: "performance" | "plan" | "week_plan";
  review: string;
  proposed_edits: ProposedEdit[];
  proposed_target_edits: ProposedTargetEdit[];
  week_plan: PlannedDay[];
  created_at: string;
};

async function getPastReviews(): Promise<CoachReview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_reviews")
    .select("id, week_start, review_type, review, proposed_edits, proposed_target_edits, week_plan, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Couldn't load past reviews: ${error.message}`);
  return data ?? [];
}

export default async function CoachPage() {
  const { userId } = await requireCoachApiKeys();
  const [reviews, profile] = await Promise.all([getPastReviews(), getTrainingProfile(userId)]);

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>AI Coach</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 8 }}>
        Generates a weekly review of your training, or a design-only review of your favorited routines,
        based on established training-science principles (progressive overload, volume landmarks, RPE
        autoregulation) — not gym folklore.
      </p>
      <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 20 }}>
        Personalizing for: {GOAL_LABELS[profile.goal]} · {EXPERIENCE_LABELS[profile.experienceLevel]} ·{" "}
        {profile.daysPerWeek}x/week · {profile.sessionMinutes} min sessions —{" "}
        <Link href="/settings">edit in Settings</Link>
      </p>

      <CoachPanel initialReviews={reviews} />
    </main>
  );
}
