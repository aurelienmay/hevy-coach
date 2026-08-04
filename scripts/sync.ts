// One-off full backfill: pulls your ENTIRE Hevy history and populates the DB.
// Run locally once: npm run sync
// (the deployed /api/sync route only pulls the last 30 days, for cheap daily cron runs)
import { sql } from "../lib/db";
import { fetchAllWorkouts, fetchAllRoutines } from "../lib/hevy";
import { muscleFor } from "../lib/muscleMap";

async function main() {
  console.log("Fetching full Hevy workout history (this can take a while)...");
  const workouts = await fetchAllWorkouts();
  console.log(`Fetched ${workouts.length} workouts.`);

  for (const w of workouts) {
    await sql`
      insert into workouts (id, title, start_time, end_time)
      values (${w.id}, ${w.title}, ${w.start_time}, ${w.end_time})
      on conflict (id) do update set title = excluded.title, end_time = excluded.end_time
    `;

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

  console.log(`Done. ${routines.length} routines synced.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
