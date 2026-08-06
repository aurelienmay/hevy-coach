import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser, setVolumeTargetOverride } from "@/lib/currentUser";
import type { ProposedTargetEdit } from "@/lib/coach";

export async function POST(req: NextRequest) {
  let body: { reviewId?: unknown; editId?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { reviewId, editId, action } = body;

  if (typeof reviewId !== "string" || !reviewId) {
    return NextResponse.json({ error: "reviewId is required" }, { status: 400 });
  }
  if (typeof editId !== "string" || !editId) {
    return NextResponse.json({ error: "editId is required" }, { status: 400 });
  }
  if (action !== "apply" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'apply' or 'reject'" }, { status: 400 });
  }

  const user = await getUser();
  const supabase = await createClient();

  const { data: reviewRow } = await supabase
    .from("coach_reviews")
    .select("id, proposed_target_edits")
    .eq("id", reviewId)
    .single<{ id: string; proposed_target_edits: ProposedTargetEdit[] }>();
  if (!reviewRow) {
    return NextResponse.json({ error: "review not found" }, { status: 404 });
  }

  const targetEdits = reviewRow.proposed_target_edits ?? [];
  const edit = targetEdits.find((e) => e.id === editId);
  if (!edit) {
    return NextResponse.json({ error: "target edit not found" }, { status: 404 });
  }
  if (edit.status !== "pending") {
    return NextResponse.json({ error: `edit already ${edit.status}` }, { status: 409 });
  }

  if (action === "apply") {
    await setVolumeTargetOverride(user.id, edit.muscle, { min: edit.newMin, max: edit.newMax });
  }

  const updatedTargetEdits = targetEdits.map((e) =>
    e.id === editId ? { ...e, status: action === "apply" ? "applied" : "rejected" } : e
  );
  const { data: row, error } = await supabase
    .from("coach_reviews")
    .update({ proposed_target_edits: updatedTargetEdits })
    .eq("id", reviewId)
    .select("id, week_start, review, proposed_edits, proposed_target_edits, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(row);
}
