import { createClient } from "@/lib/supabase/server";
import { requireCoachApiKeys } from "@/lib/currentUser";
import CoachPanel from "@/components/CoachPanel";
import type { ProposedEdit } from "@/lib/coach";

export const dynamic = "force-dynamic";

export type CoachReview = {
  id: string;
  week_start: string;
  review: string;
  proposed_edits: ProposedEdit[];
  created_at: string;
};

async function getPastReviews(): Promise<CoachReview[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("coach_reviews")
    .select("id, week_start, review, proposed_edits, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export default async function CoachPage() {
  await requireCoachApiKeys();
  const reviews = await getPastReviews();

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>AI Coach</h1>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
        Generates a weekly review of your training based on established training-science principles
        (progressive overload, volume landmarks, RPE autoregulation) — not gym folklore.
      </p>

      <CoachPanel initialReviews={reviews} />
    </main>
  );
}
