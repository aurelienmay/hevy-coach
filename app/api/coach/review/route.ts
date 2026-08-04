import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { generateWeeklyReview } from "@/lib/coach";

export const maxDuration = 60;

export async function POST() {
  try {
    const { review, proposedEdits } = await generateWeeklyReview();

    const [row] = await sql`
      insert into coach_reviews (id, week_start, review, proposed_edits)
      values (${crypto.randomUUID()}, date_trunc('week', now()), ${review}, ${sql.json(proposedEdits)})
      returning id, week_start, review, proposed_edits, created_at
    `;

    return NextResponse.json(row);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "unknown error" }, { status: 500 });
  }
}
