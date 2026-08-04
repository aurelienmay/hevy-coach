import { sql } from "@/lib/db";
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

async function getPastReviews() {
  return sql<CoachReview[]>`
    select id, week_start, review, proposed_edits, created_at
    from coach_reviews
    order by created_at desc
    limit 20
  `;
}

export default async function CoachPage() {
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
