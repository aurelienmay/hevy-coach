import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { updateRoutine } from "@/lib/hevy";
import { muscleFor } from "@/lib/muscleMap";
import { applyEditToRoutine, type ProposedEdit } from "@/lib/coach";
import type { Routine } from "@/components/RoutineCard";

export async function POST(req: NextRequest) {
  const { reviewId, editId, action } = await req.json();
  if (action !== "apply" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'apply' or 'reject'" }, { status: 400 });
  }

  const [reviewRow] = await sql<{ id: string; proposed_edits: ProposedEdit[] }[]>`
    select id, proposed_edits from coach_reviews where id = ${reviewId}
  `;
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
    const [routine] = await sql<Routine[]>`
      select id, title, updated_at, is_favorite, raw from routines where id = ${edit.routineId}
    `;
    if (!routine) {
      return NextResponse.json({ error: "routine no longer found" }, { status: 404 });
    }

    let updated;
    try {
      const payload = applyEditToRoutine(routine, edit);
      updated = await updateRoutine(edit.routineId, payload);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "failed to apply edit" }, { status: 400 });
    }

    await sql`
      update routines
      set title = ${updated.title}, updated_at = ${updated.updated_at}, raw = ${sql.json(updated)}
      where id = ${edit.routineId}
    `;

    for (const ex of updated.exercises ?? []) {
      await sql`
        insert into exercises (id, title, muscle)
        values (${ex.exercise_template_id}, ${ex.title}, ${muscleFor(ex.title)})
        on conflict (id) do nothing
      `;
    }
  }

  const updatedEdits = edits.map((e) => (e.id === editId ? { ...e, status: action === "apply" ? "applied" : "rejected" } : e));
  const [row] = await sql`
    update coach_reviews set proposed_edits = ${sql.json(updatedEdits)} where id = ${reviewId}
    returning id, week_start, review, proposed_edits, created_at
  `;

  return NextResponse.json(row);
}
