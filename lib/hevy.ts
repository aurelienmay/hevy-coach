const API_BASE = "https://api.hevyapp.com/v1";

function headers() {
  const key = process.env.HEVY_API_KEY;
  if (!key) throw new Error("HEVY_API_KEY is not set");
  return { "api-key": key, "Content-Type": "application/json" };
}

export type HevySet = {
  index: number;
  type: "normal" | "warmup" | "failure" | "dropset";
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  custom_metric: number | null;
};

export type HevyExercise = {
  index: number;
  title: string;
  notes: string | null;
  exercise_template_id: string;
  superset_id: number | null;
  rest_seconds: number | null;
  sets: HevySet[];
};

export type HevyWorkout = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  exercises: HevyExercise[];
};

// Fetches all workouts, paging until Hevy returns an empty page.
// Pass `since` (ISO date) to only pull recent workouts on subsequent syncs.
export async function fetchAllWorkouts(since?: string): Promise<HevyWorkout[]> {
  const all: HevyWorkout[] = [];
  let page = 1;
  const pageSize = 10; // Hevy's documented max per page for /workouts

  while (true) {
    const res = await fetch(`${API_BASE}/workouts?page=${page}&pageSize=${pageSize}`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Hevy API error ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    const batch: HevyWorkout[] = data.workouts ?? [];
    if (batch.length === 0) break;

    all.push(...batch);

    // Stop early once we've paged past the `since` cutoff (workouts are newest-first)
    if (since && batch[batch.length - 1].start_time < since) break;
    if (page >= (data.page_count ?? page)) break;
    page++;
  }

  return since ? all.filter((w) => w.start_time >= since) : all;
}

export type HevyRoutine = {
  id: string;
  title: string;
  updated_at: string;
  notes?: string | null;
  exercises: HevyExercise[];
};

export type HevySetUpdate = {
  type: "warmup" | "normal" | "failure" | "dropset";
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  custom_metric: number | null;
};

export type HevyExerciseUpdate = {
  exercise_template_id: string;
  superset_id: number | null;
  rest_seconds: number | null;
  notes: string | null;
  sets: HevySetUpdate[];
};

// Overwrites a routine's full exercise list. Hevy's PUT endpoint replaces the
// whole routine body, so callers must pass the complete desired exercise list,
// not a partial diff.
export async function updateRoutine(
  routineId: string,
  payload: { title: string; notes: string | null; exercises: HevyExerciseUpdate[] }
): Promise<HevyRoutine> {
  const res = await fetch(`${API_BASE}/routines/${routineId}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ routine: payload }),
  });
  if (!res.ok) {
    throw new Error(`Hevy API error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.routine ?? data;
}

export async function fetchAllRoutines(): Promise<HevyRoutine[]> {
  const all: HevyRoutine[] = [];
  let page = 1;
  const pageSize = 10; // Hevy's documented max per page for /routines

  while (true) {
    const res = await fetch(`${API_BASE}/routines?page=${page}&pageSize=${pageSize}`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Hevy API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const batch: HevyRoutine[] = data.routines ?? [];
    if (batch.length === 0) break;

    all.push(...batch);

    if (page >= (data.page_count ?? page)) break;
    page++;
  }

  return all;
}
