import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCoachApiKeys } from "@/lib/currentUser";
import { generateWeeklyReview } from "@/lib/coach";
import { startOfWeek } from "@/lib/workoutStats";
import { HevyApiError } from "@/lib/hevy";

export const maxDuration = 60;

export async function POST() {
  try {
    const { userId, hevyApiKey, anthropicApiKey } = await requireCoachApiKeys();
    const { review, proposedEdits } = await generateWeeklyReview(userId, hevyApiKey, anthropicApiKey);

    const supabase = await createClient();
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
    const status = err instanceof HevyApiError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "unknown error" }, { status });
  }
}
