import { NextRequest, NextResponse } from "next/server";
import { requireHevyApiKey } from "@/lib/currentUser";
import { fetchWorkout, updateWorkout } from "@/lib/hevy";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { apiKey } = await requireHevyApiKey();
  const { title } = await req.json();

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const workout = await fetchWorkout(apiKey, params.id);
    const payload = {
      title: title.trim(),
      description: workout.description ?? null,
      start_time: workout.start_time,
      end_time: workout.end_time,
      is_private: workout.is_private ?? false,
      exercises: workout.exercises.map((ex) => ({
        exercise_template_id: ex.exercise_template_id,
        superset_id: ex.superset_id ?? null,
        notes: ex.notes ?? null,
        sets: ex.sets.map((s) => ({
          type: s.type,
          weight_kg: s.weight_kg ?? null,
          reps: s.reps ?? null,
          distance_meters: s.distance_meters ?? null,
          duration_seconds: s.duration_seconds ?? null,
          custom_metric: s.custom_metric ?? null,
        })),
      })),
    };
    const updated = await updateWorkout(apiKey, params.id, payload);
    return NextResponse.json({ workout: updated });
  } catch (err) {
    console.error("PATCH /api/sessions failed:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
