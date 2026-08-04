import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCoachApiKeys } from "@/lib/currentUser";
import { generateWeeklyReview } from "@/lib/coach";
import { startOfWeek } from "@/lib/workoutStats";

export const maxDuration = 60;

export async function POST() {
  try {
    const { userId, hevyApiKey, anthropicApiKey } = await requireCoachApiKeys();
    const { review, proposedEdits } = await generateWeeklyReview(userId, hevyApiKey, anthropicApiKey);

    const supabase = createClient();
    const { data: row, error } = await supabase
      .from("coach_reviews")
      .insert({
        user_id: userId,
        week_start: startOfWeek().toISOString(),
        review,
        proposed_edits: proposedEdits,
      })
      .select("id, week_start, review, proposed_edits, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json(row);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "unknown error" }, { status: 500 });
  }
}
