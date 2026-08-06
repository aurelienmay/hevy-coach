import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireHevyApiKey } from "@/lib/currentUser";
import { fetchAllRoutines, updateRoutine, HevyApiError } from "@/lib/hevy";
import { buildRoutineDraft, type ProposedEdit } from "@/lib/coach";

export async function POST(req: NextRequest) {
  let body: { reviewId?: unknown; routineId?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { reviewId, routineId, action } = body;

  if (typeof reviewId !== "string" || !reviewId) {
    return NextResponse.json({ error: "reviewId is required" }, { status: 400 });
  }
  if (typeof routineId !== "string" || !routineId) {
    return NextResponse.json({ error: "routineId is required" }, { status: 400 });
  }
  if (action !== "apply" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'apply' or 'reject'" }, { status: 400 });
  }

  const { apiKey } = await requireHevyApiKey();
  const supabase = await createClient();

  const { data: reviewRow } = await supabase
    .from("coach_reviews")
    .select("id, proposed_edits")
    .eq("id", reviewId)
    .single<{ id: string; proposed_edits: ProposedEdit[] }>();
  if (!reviewRow) {
    return NextResponse.json({ error: "review not found" }, { status: 404 });
  }

  const edits = reviewRow.proposed_edits;
  const pendingForRoutine = edits.filter((e) => e.routineId === routineId && e.status === "pending");
  if (pendingForRoutine.length === 0) {
    return NextResponse.json({ error: "no pending edits for this routine" }, { status: 404 });
  }

  if (action === "apply") {
    const routines = await fetchAllRoutines(apiKey);
    const routine = routines.find((r) => r.id === routineId);
    if (!routine) {
      return NextResponse.json({ error: "routine no longer found" }, { status: 404 });
    }

    try {
      const draft = buildRoutineDraft({ ...routine, is_favorite: true }, pendingForRoutine);
      await updateRoutine(apiKey, routineId, draft.payload);
    } catch (err) {
      const status = err instanceof HevyApiError ? err.status : 400;
      return NextResponse.json({ error: err instanceof Error ? err.message : "failed to apply edits" }, { status });
    }
  }

  const appliedIds = new Set(pendingForRoutine.map((e) => e.id));
  const updatedEdits = edits.map((e) => (appliedIds.has(e.id) ? { ...e, status: action === "apply" ? "applied" : "rejected" } : e));
  const { data: row, error } = await supabase
    .from("coach_reviews")
    .update({ proposed_edits: updatedEdits })
    .eq("id", reviewId)
    .select("id, week_start, review, proposed_edits, proposed_target_edits, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(row);
}
