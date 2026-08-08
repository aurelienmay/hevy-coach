import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCoachApiKeys } from "@/lib/currentUser";
import { generateAdaptedWeekPlan } from "@/lib/coach";
import { startOfWeek } from "@/lib/workoutStats";
import { HevyApiError } from "@/lib/hevy";

export const maxDuration = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  let body: { weekStart?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { weekStart } = body;
  if (typeof weekStart !== "string" || !DATE_RE.test(weekStart)) {
    return NextResponse.json({ error: "weekStart must be a YYYY-MM-DD date" }, { status: 400 });
  }

  try {
    const { userId, hevyApiKey, anthropicApiKey } = await requireCoachApiKeys();
    const monday = startOfWeek(new Date(`${weekStart}T00:00:00`));
    const { summary, days } = await generateAdaptedWeekPlan(userId, hevyApiKey, anthropicApiKey, monday);

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("coach_reviews")
      .insert({
        user_id: userId,
        week_start: monday.toISOString(),
        review_type: "week_plan",
        review: summary,
        proposed_edits: [],
        proposed_target_edits: [],
        week_plan: days,
      })
      .select("id, week_start, review_type, review, proposed_edits, proposed_target_edits, week_plan, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json(row);
  } catch (err) {
    console.error(err);
    const status = err instanceof HevyApiError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "unknown error" }, { status });
  }
}
