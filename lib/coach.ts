import { muscleFor } from "@/lib/muscleMap";
import { EXCLUDED_MUSCLES } from "@/lib/volumeTargets";
import { computePlanVolume } from "@/lib/planVolume";
import type { Routine, RoutineExercise, RoutineSet } from "@/components/RoutineCard";
import { fetchAllRoutines, fetchAllWorkouts, type HevyExerciseUpdate, type HevySetUpdate, type HevyWorkout } from "@/lib/hevy";
import { muscleVolume, startOfWeek, workingSets, workoutsInRange } from "@/lib/workoutStats";
import { getVolumeTargets, type VolumeTargets } from "@/lib/currentUser";
import { createClient } from "@/lib/supabase/server";

export type ProposedEdit = {
  id: string;
  routineId: string;
  routineTitle: string;
  exerciseIndex: number;
  exerciseTitle: string;
  action: "add_set" | "remove_set";
  count: number;
  rationale: string;
  status: "pending" | "applied" | "rejected";
};

type ExerciseSession = {
  date: string;
  workingSets: number;
  topWeightKg: number | null;
  topReps: number | null;
  avgRpe: number | null;
};

type ExerciseProgression = {
  exerciseId: string;
  title: string;
  muscle: string;
  sessions: ExerciseSession[];
};

type WeeklyData = {
  weekStart: string;
  currentWeekVolume: { muscle: string; sets: number }[];
  planVolume: { muscle: string; sets: number }[];
  priorWeeksVolume: { weekStart: string; muscle: string; sets: number }[];
  sessionsThisWeek: { title: string; start_time: string; workingSets: number; totalSets: number }[];
  progression: ExerciseProgression[];
  favorites: Routine[];
  targets: VolumeTargets;
};

async function gatherWeeklyData(userId: string, hevyApiKey: string): Promise<WeeklyData> {
  const supabase = createClient();
  const [allRoutines, workouts, { data: favoriteRows }, targets] = await Promise.all([
    fetchAllRoutines(hevyApiKey),
    fetchAllWorkouts(hevyApiKey, new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("favorite_routines").select("routine_id").eq("user_id", userId),
    getVolumeTargets(userId),
  ]);
  const favoriteIds = new Set((favoriteRows ?? []).map((r) => r.routine_id));
  const favorites: Routine[] = allRoutines
    .filter((r) => favoriteIds.has(r.id))
    .map((r) => ({ ...r, is_favorite: true }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const weekStart = startOfWeek();
  const thisWeekWorkouts = workoutsInRange(workouts, weekStart);
  const currentWeekVolume = muscleVolume(thisWeekWorkouts, EXCLUDED_MUSCLES);

  const priorWeeksVolume: { weekStart: string; muscle: string; sets: number }[] = [];
  for (let i = 1; i <= 4; i++) {
    const from = new Date(weekStart.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const to = new Date(weekStart.getTime() - (i - 1) * 7 * 24 * 60 * 60 * 1000);
    const weekWorkouts = workoutsInRange(workouts, from, to);
    for (const { muscle, sets } of muscleVolume(weekWorkouts, EXCLUDED_MUSCLES)) {
      priorWeeksVolume.push({ weekStart: from.toISOString().slice(0, 10), muscle, sets });
    }
  }
  priorWeeksVolume.sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : b.sets - a.sets));

  const sessionsThisWeek = [...thisWeekWorkouts]
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .map((w) => ({
      title: w.title,
      start_time: w.start_time,
      workingSets: workingSets(w).length,
      totalSets: w.exercises.reduce((sum, ex) => sum + ex.sets.length, 0),
    }));

  const exerciseIds = Array.from(
    new Set(favorites.flatMap((r) => (r.exercises ?? []).map((ex) => ex.exercise_template_id).filter(Boolean)))
  );

  const progression = gatherProgression(workouts, exerciseIds);

  return {
    weekStart: new Date().toISOString(),
    currentWeekVolume,
    planVolume: computePlanVolume(favorites),
    priorWeeksVolume,
    sessionsThisWeek,
    progression,
    favorites,
    targets,
  };
}

function gatherProgression(workouts: HevyWorkout[], exerciseIds: string[]): ExerciseProgression[] {
  const wanted = new Set(exerciseIds);
  const byExercise = new Map<
    string,
    { title: string; muscle: string; bySession: Map<string, { weight_kg: number | null; reps: number | null; rpe: number | null }[]> }
  >();

  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (!wanted.has(ex.exercise_template_id)) continue;
      const workingSetsForEx = ex.sets.filter((s) => s.type !== "warmup");
      if (workingSetsForEx.length === 0) continue;

      const muscle = muscleFor(ex.title);
      if (!byExercise.has(ex.exercise_template_id)) {
        byExercise.set(ex.exercise_template_id, { title: ex.title, muscle, bySession: new Map() });
      }
      const entry = byExercise.get(ex.exercise_template_id)!;
      const key = w.start_time;
      if (!entry.bySession.has(key)) entry.bySession.set(key, []);
      entry.bySession.get(key)!.push(
        ...workingSetsForEx.map((s) => ({ weight_kg: s.weight_kg, reps: s.reps, rpe: s.rpe }))
      );
    }
  }

  const result: ExerciseProgression[] = [];
  for (const [exerciseId, { title, muscle, bySession }] of byExercise) {
    const sessions: ExerciseSession[] = Array.from(bySession.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([date, sets]) => {
        const rpes = sets.map((s) => s.rpe).filter((v): v is number => v != null);
        const weighted = sets.filter((s) => s.weight_kg != null);
        return {
          date,
          workingSets: sets.length,
          topWeightKg: weighted.length ? Math.max(...weighted.map((s) => Number(s.weight_kg))) : null,
          topReps: sets.length ? Math.max(...sets.map((s) => s.reps ?? 0)) : null,
          avgRpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
        };
      })
      .slice(-5);
    result.push({ exerciseId, title, muscle, sessions });
  }
  return result;
}

function buildSystemPrompt(): string {
  return `You are an evidence-based strength & hypertrophy coach reviewing a client's training week.

Ground every recommendation in established resistance-training science consensus:
- Progressive overload over time (increasing weight, reps, or sets across sessions for the same exercise).
- Weekly volume landmarks per muscle group (roughly 10-20 working sets/week for major muscle groups, 8-15 for smaller ones, based on dose-response volume research such as Schoenfeld et al.'s meta-analyses and volume-landmark frameworks like Israetel's).
- Training frequency of at least ~2x/week per muscle group for hypertrophy.
- RPE/RIR-based autoregulation (Helms et al.) to manage fatigue and avoid overreaching.
- Recovery and periodic deloads (roughly every 6-8 weeks of accumulating fatigue).

Do NOT invent specific fake study citations, authors, or statistics you are not confident about. Refer to general, well-established consensus rather than fabricated sources. Do not give "bro science" advice (e.g. vague folklore about muscle confusion, feeling sore, etc.) — every claim should be traceable to the principles above.

You will be given: this week's actual performed training, the client's intended weekly plan (their favorited/starred routines), the last 4 weeks of volume history per muscle, and recent per-exercise progression (weight/reps/RPE trend). Also given: the exact structure of the client's favorited routines (with exercise indices) so you can propose concrete set-count adjustments.

Respond with ONLY a single JSON object (no markdown fences, no prose outside the JSON) matching this shape:
{
  "review": "<markdown-formatted weekly review: what went well, what's off-track vs targets, adherence to the plan, progressive-overload assessment per key exercise, and concrete recommendations for next week>",
  "proposedEdits": [
    {
      "routineId": "<exact routineId from the provided routine list>",
      "routineTitle": "<exact routine title>",
      "exerciseIndex": <exact integer index from the provided exercise list for that routine>,
      "exerciseTitle": "<exact exercise title at that index>",
      "action": "add_set" | "remove_set",
      "count": <integer, how many sets to add or remove>,
      "rationale": "<one sentence, tied to volume landmarks or overload/recovery principles>"
    }
  ]
}

Only propose edits when volume is clearly below or above the target range for a muscle, or when an exercise's set count should change based on trend/recovery. If nothing needs to change, return an empty proposedEdits array. Never propose edits for routines or exercise indices not present in the provided list.`;
}

function buildUserPrompt(data: WeeklyData): string {
  const lines: string[] = [];

  lines.push(`## This week's actual performance (since ${data.weekStart.slice(0, 10)}, week starting Monday)`);
  if (data.sessionsThisWeek.length === 0) {
    lines.push("No sessions logged yet this week.");
  } else {
    for (const s of data.sessionsThisWeek) {
      lines.push(`- ${s.start_time.slice(0, 10)}: "${s.title}" — ${s.workingSets} working sets (${s.totalSets} total incl. warmups)`);
    }
  }

  lines.push(`\n## This week's working sets per muscle vs. target`);
  const actualByMuscle = new Map(data.currentWeekVolume.map((v) => [v.muscle, v.sets]));
  const allMuscles = Array.from(new Set([...Object.keys(data.targets), ...actualByMuscle.keys()]));
  for (const muscle of allMuscles) {
    const target = data.targets[muscle];
    lines.push(`- ${muscle}: ${actualByMuscle.get(muscle) ?? 0} sets (target ${target ? `${target.min}-${target.max}` : "n/a"})`);
  }

  lines.push(`\n## Intended weekly plan volume (from favorited/starred routines) per muscle vs. target`);
  const planByMuscle = new Map(data.planVolume.map((v) => [v.muscle, v.sets]));
  for (const muscle of allMuscles) {
    const target = data.targets[muscle];
    lines.push(`- ${muscle}: ${planByMuscle.get(muscle) ?? 0} sets planned (target ${target ? `${target.min}-${target.max}` : "n/a"})`);
  }

  lines.push(`\n## Last 4 weeks volume history per muscle (working sets)`);
  const byWeek = new Map<string, Map<string, number>>();
  for (const row of data.priorWeeksVolume) {
    if (!byWeek.has(row.weekStart)) byWeek.set(row.weekStart, new Map());
    byWeek.get(row.weekStart)!.set(row.muscle, row.sets);
  }
  for (const [week, muscles] of byWeek) {
    lines.push(`- Week of ${week}: ${Array.from(muscles.entries()).map(([m, s]) => `${m}=${s}`).join(", ")}`);
  }

  lines.push(`\n## Per-exercise progression (last up to 5 sessions, oldest to newest, working sets only)`);
  for (const ex of data.progression) {
    const trail = ex.sessions
      .map((s) => `${s.date.slice(0, 10)}: ${s.workingSets} sets, top ${s.topWeightKg ?? "?"}kg x ${s.topReps ?? "?"}${s.avgRpe ? `, avg RPE ${s.avgRpe}` : ""}`)
      .join(" | ");
    lines.push(`- ${ex.title} (${ex.muscle}): ${trail || "no recent data"}`);
  }

  lines.push(`\n## Favorited routines structure (for proposing set-count edits)`);
  for (const r of data.favorites) {
    lines.push(`### Routine "${r.title}" (routineId: ${r.id})`);
    const exercises = [...(r.exercises ?? [])].sort((a, b) => a.index - b.index);
    exercises.forEach((ex: RoutineExercise) => {
      const workingSets = ex.sets.filter((s) => s.type !== "warmup").length;
      lines.push(`  [${ex.index}] ${ex.title} (${muscleFor(ex.title)}) — currently ${workingSets} working sets`);
    });
  }

  return lines.join("\n");
}

function parseReviewJson(text: string): { review: string; proposedEdits: Omit<ProposedEdit, "id" | "status">[] } {
  let cleaned = text.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) cleaned = fenced[1].trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall back to the outermost { ... } block, in case there's stray prose around the JSON.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      console.error("Coach review response was not parseable JSON. Raw text:", text);
      throw new Error("The coach's response wasn't valid JSON — try generating again.");
    }
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      console.error("Coach review response was not parseable JSON. Raw text:", text);
      throw new Error("The coach's response wasn't valid JSON — try generating again.");
    }
  }
}

export async function generateWeeklyReview(
  userId: string,
  hevyApiKey: string,
  anthropicApiKey: string
): Promise<{ review: string; proposedEdits: ProposedEdit[] }> {
  const data = await gatherWeeklyData(userId, hevyApiKey);
  const userPrompt = buildUserPrompt(data);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 8192,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  }

  const body = await res.json();
  const text: string = (body.content ?? [])
    .filter((block: { type: string }) => block.type === "text")
    .map((block: { text: string }) => block.text)
    .join("");

  if (body.stop_reason === "max_tokens") {
    console.error("Coach review truncated by max_tokens. Raw text:", text);
    throw new Error("The coach's response was cut off (too long) — try again.");
  }

  const parsed = parseReviewJson(text);

  const favoriteById = new Map(data.favorites.map((r) => [r.id, r]));
  const proposedEdits: ProposedEdit[] = (parsed.proposedEdits ?? [])
    .filter((edit) => {
      const routine = favoriteById.get(edit.routineId);
      if (!routine) return false;
      const exercises = routine.exercises ?? [];
      const ex = exercises.find((e) => e.index === edit.exerciseIndex);
      return !!ex && ex.title === edit.exerciseTitle;
    })
    .map((edit) => ({
      ...edit,
      id: crypto.randomUUID(),
      status: "pending" as const,
    }));

  return { review: parsed.review, proposedEdits };
}

function cleanSet(s: RoutineSet): HevySetUpdate {
  return {
    type: s.type as HevySetUpdate["type"],
    weight_kg: s.weight_kg,
    reps: s.reps,
    distance_meters: s.distance_meters,
    duration_seconds: s.duration_seconds,
    custom_metric: s.custom_metric,
  };
}

// Builds the full replacement payload Hevy's PUT /v1/routines/{id} expects,
// applying a single set-count edit to one exercise and passing every other
// exercise through unchanged (the endpoint replaces the whole routine body).
export function applyEditToRoutine(
  routine: Routine,
  edit: ProposedEdit
): { title: string; notes: string | null; exercises: HevyExerciseUpdate[] } {
  const exercises = [...(routine.exercises ?? [])].sort((a, b) => a.index - b.index);
  const target = exercises.find((e) => e.index === edit.exerciseIndex);
  if (!target || target.title !== edit.exerciseTitle) {
    throw new Error("This routine changed since the review was generated — regenerate a new review before applying.");
  }

  const updatedExercises: HevyExerciseUpdate[] = exercises.map((ex: RoutineExercise) => {
    let sets = ex.sets.map(cleanSet);
    if (ex.index === edit.exerciseIndex) {
      if (edit.action === "add_set") {
        const template = sets[sets.length - 1] ?? {
          type: "normal",
          weight_kg: null,
          reps: null,
          distance_meters: null,
          duration_seconds: null,
          custom_metric: null,
        };
        for (let i = 0; i < edit.count; i++) sets.push({ ...template });
      } else {
        const removeCount = Math.min(edit.count, Math.max(0, sets.length - 1));
        sets = sets.slice(0, sets.length - removeCount);
      }
    }
    return {
      exercise_template_id: ex.exercise_template_id,
      superset_id: ex.superset_id,
      rest_seconds: ex.rest_seconds,
      notes: ex.notes,
      sets,
    };
  });

  return { title: routine.title, notes: routine.notes ?? null, exercises: updatedExercises };
}
