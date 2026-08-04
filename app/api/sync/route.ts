import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { fetchAllWorkouts, fetchAllRoutines } from "@/lib/hevy";
import { muscleFor } from "@/lib/muscleMap";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Vercel Cron sends this header automatically; also allow a manual secret for local runs.
  const authHeader = req.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Only pull the last 30 days on routine syncs; do a full backfill separately (see scripts/sync.ts).
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const workouts = await fetchAllWorkouts(since);

  let workoutsWritten = 0;
  let setsWritten = 0;

  for (const w of workouts) {
    await sql`
      insert into workouts (id, title, start_time, end_time)
      values (${w.id}, ${w.title}, ${w.start_time}, ${w.end_time})
      on conflict (id) do update set title = excluded.title, end_time = excluded.end_time
    `;
    workoutsWritten++;

    for (const ex of w.exercises) {
      await sql`
        insert into exercises (id, title, muscle)
        values (${ex.exercise_template_id}, ${ex.title}, ${muscleFor(ex.title)})
        on conflict (id) do nothing
      `;

      for (const s of ex.sets) {
        const setId = `${w.id}-${ex.index}-${s.index}`;
        await sql`
          insert into sets (
            id, workout_id, exercise_id, exercise_title, exercise_order,
            set_index, set_type, weight_kg, reps, rpe, duration_seconds, distance_km
          ) values (
            ${setId}, ${w.id}, ${ex.exercise_template_id}, ${ex.title}, ${ex.index},
            ${s.index}, ${s.type}, ${s.weight_kg}, ${s.reps}, ${s.rpe},
            ${s.duration_seconds}, ${s.distance_meters ? s.distance_meters / 1000 : null}
          )
          on conflict (id) do update set
            weight_kg = excluded.weight_kg,
            reps = excluded.reps,
            set_type = excluded.set_type
        `;
        setsWritten++;
      }
    }
  }

  const routines = await fetchAllRoutines();
  for (const r of routines) {
    await sql`
      insert into routines (id, title, updated_at, raw)
      values (${r.id}, ${r.title}, ${r.updated_at}, ${sql.json(r)})
      on conflict (id) do update set title = excluded.title, updated_at = excluded.updated_at, raw = excluded.raw
    `;
  }

  return NextResponse.json({
    ok: true,
    workoutsWritten,
    setsWritten,
    routinesWritten: routines.length,
  });
}
