import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireHevyApiKey } from "@/lib/currentUser";
import { createRoutine, HevyApiError } from "@/lib/hevy";
import { buildCreateRoutinePayload, type PlannedDay } from "@/lib/coach";

export async function POST(req: NextRequest) {
  let body: { reviewId?: unknown; date?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { reviewId, date } = body;

  if (typeof reviewId !== "string" || !reviewId) {
    return NextResponse.json({ error: "reviewId is required" }, { status: 400 });
  }
  if (typeof date !== "string" || !date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const { apiKey } = await requireHevyApiKey();
  const supabase = await createClient();

  const { data: reviewRow } = await supabase
    .from("coach_reviews")
    .select("id, week_plan")
    .eq("id", reviewId)
    .eq("review_type", "week_plan")
    .single<{ id: string; week_plan: PlannedDay[] }>();
  if (!reviewRow) {
    return NextResponse.json({ error: "week plan not found" }, { status: 404 });
  }

  const days = reviewRow.week_plan;
  const dayIndex = days.findIndex((d) => d.date === date);
  if (dayIndex === -1) {
    return NextResponse.json({ error: "no such day in this week plan" }, { status: 404 });
  }
  const day = days[dayIndex];
  if (day.status !== "train" || day.exercises.length === 0) {
    return NextResponse.json({ error: "this day has no planned session to push" }, { status: 400 });
  }
  if (day.hevyRoutineId) {
    return NextResponse.json({ error: "this day was already pushed to Hevy" }, { status: 409 });
  }

  let created;
  try {
    created = await createRoutine(apiKey, buildCreateRoutinePayload(day));
  } catch (err) {
    const status = err instanceof HevyApiError ? err.status : 400;
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed to create routine" }, { status });
  }

  const updatedDays = days.map((d, i) => (i === dayIndex ? { ...d, hevyRoutineId: created.id } : d));
  const { data: row, error } = await supabase
    .from("coach_reviews")
    .update({ week_plan: updatedDays })
    .eq("id", reviewId)
    .select("id, week_start, review_type, review, proposed_edits, proposed_target_edits, week_plan, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(row);
}
