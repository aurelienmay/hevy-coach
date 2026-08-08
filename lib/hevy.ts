const API_BASE = "https://api.hevyapp.com/v1";

// Thrown whenever Hevy returns a non-OK response, carrying the status code so
// callers can tell "your API key is bad" (401/403) apart from "Hevy is down
// or rate-limiting you" (429/5xx) instead of showing one generic failure.
export class HevyApiError extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`Hevy API error ${status}: ${body}`);
    this.name = "HevyApiError";
    this.status = status;
  }
}

function headers(apiKey: string) {
  return { "api-key": apiKey, "Content-Type": "application/json" };
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
  description?: string | null;
  start_time: string;
  end_time: string;
  is_private?: boolean;
  exercises: HevyExercise[];
};

// Fetches all workouts, paging until Hevy returns an empty page.
// Pass `since` (ISO date) to only pull recent workouts on subsequent syncs.
export async function fetchAllWorkouts(apiKey: string, since?: string): Promise<HevyWorkout[]> {
  const all: HevyWorkout[] = [];
  let page = 1;
  const pageSize = 10; // Hevy's documented max per page for /workouts

  while (true) {
    const res = await fetch(`${API_BASE}/workouts?page=${page}&pageSize=${pageSize}`, {
      headers: headers(apiKey),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new HevyApiError(res.status, await res.text());
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

export async function fetchWorkout(apiKey: string, workoutId: string): Promise<HevyWorkout> {
  const res = await fetch(`${API_BASE}/workouts/${workoutId}`, {
    headers: headers(apiKey),
    cache: "no-store",
  });
  if (!res.ok) throw new HevyApiError(res.status, await res.text());
  const data = await res.json();
  return data.workout ?? data;
}

// Unlike routines, the workout PUT endpoint rejects `rest_seconds` on
// exercises ("Unrecognized key(s) in object") — omit it here.
export type HevyWorkoutExerciseUpdate = Omit<HevyExerciseUpdate, "rest_seconds">;

// Overwrites a workout's full body, mirroring updateRoutine below: Hevy's PUT
// endpoint replaces the whole workout, so callers must pass the complete
// desired state, not a partial diff.
export async function updateWorkout(
  apiKey: string,
  workoutId: string,
  payload: {
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    is_private: boolean;
    exercises: HevyWorkoutExerciseUpdate[];
  }
): Promise<HevyWorkout> {
  const res = await fetch(`${API_BASE}/workouts/${workoutId}`, {
    method: "PUT",
    headers: headers(apiKey),
    body: JSON.stringify({ workout: payload }),
  });
  if (!res.ok) {
    throw new HevyApiError(res.status, await res.text());
  }
  const data = await res.json();
  return data.workout ?? data;
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
  apiKey: string,
  routineId: string,
  payload: { title: string; notes: string | null; exercises: HevyExerciseUpdate[] }
): Promise<HevyRoutine> {
  const res = await fetch(`${API_BASE}/routines/${routineId}`, {
    method: "PUT",
    headers: headers(apiKey),
    body: JSON.stringify({ routine: payload }),
  });
  if (!res.ok) {
    throw new HevyApiError(res.status, await res.text());
  }
  const data = await res.json();
  return data.routine ?? data;
}

// Creates a brand-new routine. Same body shape as updateRoutine, but POSTs
// without an id since Hevy assigns one.
export async function createRoutine(
  apiKey: string,
  payload: { title: string; notes: string | null; exercises: HevyExerciseUpdate[] }
): Promise<HevyRoutine> {
  const res = await fetch(`${API_BASE}/routines`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ routine: payload }),
  });
  if (!res.ok) {
    throw new HevyApiError(res.status, await res.text());
  }
  const data = await res.json();
  return data.routine ?? data;
}

export async function fetchRoutine(apiKey: string, routineId: string): Promise<HevyRoutine> {
  const res = await fetch(`${API_BASE}/routines/${routineId}`, {
    headers: headers(apiKey),
    cache: "no-store",
  });
  if (!res.ok) throw new HevyApiError(res.status, await res.text());
  const data = await res.json();
  return data.routine ?? data;
}

export async function fetchAllRoutines(apiKey: string): Promise<HevyRoutine[]> {
  const all: HevyRoutine[] = [];
  let page = 1;
  const pageSize = 10; // Hevy's documented max per page for /routines

  while (true) {
    const res = await fetch(`${API_BASE}/routines?page=${page}&pageSize=${pageSize}`, {
      headers: headers(apiKey),
      cache: "no-store",
    });
    if (!res.ok) throw new HevyApiError(res.status, await res.text());
    const data = await res.json();
    const batch: HevyRoutine[] = data.routines ?? [];
    if (batch.length === 0) break;

    all.push(...batch);

    if (page >= (data.page_count ?? page)) break;
    page++;
  }

  return all;
}
