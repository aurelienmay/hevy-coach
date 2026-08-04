import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireHevyApiKey } from "@/lib/currentUser";
import { fetchAllRoutines, updateRoutine } from "@/lib/hevy";
import { applyEditToRoutine, type ProposedEdit } from "@/lib/coach";

export async function POST(req: NextRequest) {
  const { reviewId, editId, action } = await req.json();
  if (action !== "apply" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'apply' or 'reject'" }, { status: 400 });
  }

  const { apiKey } = await requireHevyApiKey();
  const supabase = createClient();

  const { data: reviewRow } = await supabase
    .from("coach_reviews")
    .select("id, proposed_edits")
    .eq("id", reviewId)
    .single<{ id: string; proposed_edits: ProposedEdit[] }>();
  if (!reviewRow) {
    return NextResponse.json({ error: "review not found" }, { status: 404 });
  }

  const edits = reviewRow.proposed_edits;
  const edit = edits.find((e) => e.id === editId);
  if (!edit) {
    return NextResponse.json({ error: "edit not found" }, { status: 404 });
  }
  if (edit.status !== "pending") {
    return NextResponse.json({ error: `edit already ${edit.status}` }, { status: 409 });
  }

  if (action === "apply") {
    const routines = await fetchAllRoutines(apiKey);
    const routine = routines.find((r) => r.id === edit.routineId);
    if (!routine) {
      return NextResponse.json({ error: "routine no longer found" }, { status: 404 });
    }

    try {
      const payload = applyEditToRoutine({ ...routine, is_favorite: true }, edit);
      await updateRoutine(apiKey, edit.routineId, payload);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "failed to apply edit" }, { status: 400 });
    }
  }

  const updatedEdits = edits.map((e) => (e.id === editId ? { ...e, status: action === "apply" ? "applied" : "rejected" } : e));
  const { data: row, error } = await supabase
    .from("coach_reviews")
    .update({ proposed_edits: updatedEdits })
    .eq("id", reviewId)
    .select("id, week_start, review, proposed_edits, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(row);
}
