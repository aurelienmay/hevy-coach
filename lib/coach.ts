import { muscleFor } from "@/lib/muscleMap";
import { EXCLUDED_MUSCLES } from "@/lib/volumeTargets";
import { computePlanVolume } from "@/lib/planVolume";
import type { Routine, RoutineExercise, RoutineSet } from "@/components/RoutineCard";
import { fetchAllRoutines, fetchAllWorkouts, type HevyExerciseUpdate, type HevySetUpdate, type HevyWorkout } from "@/lib/hevy";
import { muscleVolume, startOfWeek, workingSets, workoutsInRange } from "@/lib/workoutStats";
import { getVolumeTargets, getTrainingProfile, getMusclePriorities, type VolumeTargets } from "@/lib/currentUser";
import {
  GOAL_LABELS,
  EXPERIENCE_LABELS,
  MUSCLE_PRIORITY_LABELS,
  type TrainingProfile,
  type MusclePriorities,
} from "@/lib/trainingProfile";
import { createClient } from "@/lib/supabase/server";

const MAX_DRAFT_ROUTINES = 4;

export type ProposedEdit = {
  id: string;
  routineId: string;
  routineTitle: string;
  exerciseIndex: number;
  exerciseTitle: string;
  action: "add_set" | "remove_set" | "change_weight" | "change_rest_seconds";
  count?: number;
  newWeightKg?: number;
  newRestSeconds?: number;
  rationale: string;
  status: "pending" | "applied" | "rejected";
  // Snapshot of the exercise's state at the moment the review was generated,
  // computed server-side from the live routine (not trusted from the LLM) so
  // the compare UI can render a before/after diff without another Hevy fetch.
  before: { workingSets: number; topWeightKg: number | null; restSeconds: number | null };
};

export type ProposedTargetEdit = {
  id: string;
  muscle: string;
  currentMin: number;
  currentMax: number;
  newMin: number;
  newMax: number;
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
  profile: TrainingProfile;
  musclePriorities: MusclePriorities;
};

async function gatherWeeklyData(userId: string, hevyApiKey: string): Promise<WeeklyData> {
  const supabase = await createClient();
  const [allRoutines, workouts, { data: favoriteRows }, targets, profile, musclePriorities] = await Promise.all([
    fetchAllRoutines(hevyApiKey),
    fetchAllWorkouts(hevyApiKey, new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("favorite_routines").select("routine_id").eq("user_id", userId),
    getVolumeTargets(userId),
    getTrainingProfile(userId),
    getMusclePriorities(userId),
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
    profile,
    musclePriorities,
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

const ANTI_HALLUCINATION_PREAMBLE = `Before writing anything, follow these rules strictly:
- Use ONLY the facts given to you in the data below. Never invent sessions, sets, weights, reps, RPE values, exercises, routines, or dates that are not explicitly present in the data.
- If the data needed to assess something is missing or insufficient, say so explicitly (e.g. "not enough data yet to assess progressive overload on this lift") rather than filling the gap with a plausible-sounding guess.
- Do NOT cite specific studies, authors, or statistics unless you are confident they are real and well-established (e.g. it is fine to say "Schoenfeld et al.'s volume-landmark research" as a general reference, but never invent a specific number, year, or finding you are not sure of).
- Every recommendation must trace back either to a specific number in the provided data or to one of the general training-science principles below — never to generic gym folklore ("muscle confusion", "shocking the muscle", vague soreness talk, etc.).
- Keep the tone factual and specific to this client's numbers, not generic filler that could apply to anyone.

`;

const VOLUME_LANDMARKS_PRINCIPLE = `- Reason about volume using the same landmark framework this app's own computed targets are built from (Israetel et al.'s volume landmarks): MV (Maintenance Volume, the floor needed to hold current size/strength), MEV (Minimum Effective Volume, where growth actually starts), MAV (Maximum Adaptive Volume, the productive sweet-spot range most training should live in), and MRV (Maximum Recoverable Volume, the hard ceiling beyond which extra sets stop adding growth and just add fatigue/injury risk — "junk volume"). More sets is not automatically better: never propose pushing a muscle's volume above its own MRV-derived target-range max just because the client is under target elsewhere or has recovery headroom in general — each muscle's ceiling is independent of every other muscle's, so freeing up capacity by reducing one muscle's volume is never itself a reason to add volume to a different, unrelated muscle.`;

const PERSONALIZATION_PRINCIPLE = `- Tailor advice to the client's stated goal, experience level, and schedule (given below): for a "strength" goal, favor lower rep ranges, heavier loads, and longer inter-set rest in exercise-level guidance; for "hypertrophy", use moderate rep ranges as usual; for "fat_loss" or "general_fitness", keep volume moderate and note that conditioning/diet drive that goal more than raw set count. Calibrate how aggressive volume/load changes are to experience level — smaller, more conservative jumps for beginners, more nuanced adjustments are fine for advanced trainees. Keep any proposed weekly volume realistic for the client's training days/week and session time budget — don't propose more sets than could plausibly fit in the available sessions.
- Respect any stated per-muscle priorities, using the MV/MEV/MAV/MRV landmarks above: a muscle marked "maintain" should be trained in its MV-MEV window — do not propose adding sets or increasing volume even if it reads under the general landmark range, since the client has deliberately chosen to hold it flat; only flag it if volume has dropped below MV entirely, risking losing size/strength. A muscle marked "focus" should be trained toward its MAV-MRV window — actively look for ways to add volume, frequency, or exercise variety up to (never beyond) its MRV, and prioritize progressive-overload attention on it over non-focus muscles. A muscle marked "ignore" gets no commentary at all — no volume commentary, no target comparison, no proposed edits — the client has explicitly said they don't care about it; it will simply have no target range in the data provided, so treat any exercises for it as out of scope.`;

function buildClientProfileSection(profile: TrainingProfile, musclePriorities: MusclePriorities): string {
  const lines = [
    `\n## Client profile`,
    `- Goal: ${GOAL_LABELS[profile.goal]}`,
    `- Experience level: ${EXPERIENCE_LABELS[profile.experienceLevel]}`,
    `- Training days/week: ${profile.daysPerWeek}`,
    `- Session time budget: ${profile.sessionMinutes} minutes`,
  ];
  if (profile.notes.trim()) {
    lines.push(`- Notes from client (injuries/equipment/preferences): ${profile.notes.trim()}`);
  }
  const nonNormal = Object.entries(musclePriorities).filter(([, p]) => p !== "normal");
  if (nonNormal.length > 0) {
    lines.push(
      `- Muscle priorities: ${nonNormal.map(([muscle, p]) => `${muscle}=${MUSCLE_PRIORITY_LABELS[p]}`).join(", ")}`
    );
  }
  return lines.join("\n");
}

function buildSystemPrompt(): string {
  return `${ANTI_HALLUCINATION_PREAMBLE}You are an evidence-based strength & hypertrophy coach reviewing a client's training week.

Ground every recommendation in established resistance-training science consensus:
- Progressive overload over time (increasing weight, reps, or sets across sessions for the same exercise) — use the per-exercise weight/reps/RPE trend provided to judge whether load should increase, hold, or (rarely) decrease.
${VOLUME_LANDMARKS_PRINCIPLE}
- Training frequency of at least ~2x/week per muscle group for hypertrophy.
- RPE/RIR-based autoregulation (Helms et al.) to manage fatigue and avoid overreaching — an exercise trending toward high RPE at the same weight/reps is a signal to hold or add recovery, not add more volume.
- Rest-interval science: roughly 2-3 minutes between sets for compound/multi-joint lifts (to maintain load and total volume across sets), roughly 60-90 seconds for single-joint/isolation accessory work, per rest-interval research (e.g. Schoenfeld & Grgic).
- Recovery and periodic deloads (roughly every 6-8 weeks of accumulating fatigue).
${PERSONALIZATION_PRINCIPLE}

Do NOT invent specific fake study citations, authors, or statistics you are not confident about. Refer to general, well-established consensus rather than fabricated sources. Do not give "bro science" advice (e.g. vague folklore about muscle confusion, feeling sore, etc.) — every claim should be traceable to the principles above.

You will be given: the client's profile (goal, experience level, training days/week, session time budget, and any notes), this week's actual performed training, the client's intended weekly plan (their favorited/starred routines), the last 4 weeks of volume history per muscle, recent per-exercise progression (weight/reps/RPE trend), the client's current weekly volume-target range per muscle, and the exact structure of the client's favorited routines (with exercise indices, current working-set counts, weights, and rest periods) so you can propose concrete changes.

Respond with ONLY a single JSON object (no markdown fences, no prose outside the JSON) matching this shape:
{
  "review": "<markdown-formatted weekly review: what went well, what's off-track vs targets, adherence to the plan, progressive-overload assessment per key exercise, and concrete recommendations for next week>",
  "proposedEdits": [
    {
      "routineId": "<exact routineId from the provided routine list>",
      "routineTitle": "<exact routine title>",
      "exerciseIndex": <exact integer index from the provided exercise list for that routine>,
      "exerciseTitle": "<exact exercise title at that index>",
      "action": "add_set" | "remove_set" | "change_weight" | "change_rest_seconds",
      "count": <integer, required for add_set/remove_set: how many sets to add or remove>,
      "newWeightKg": <number, required for change_weight: the new working-set weight in kg>,
      "newRestSeconds": <integer, required for change_rest_seconds: the new rest period in seconds>,
      "rationale": "<one sentence, tied to volume landmarks, overload/recovery, or rest-interval principles>"
    }
  ],
  "proposedTargetEdits": [
    {
      "muscle": "<exact muscle key from the provided target list>",
      "newMin": <integer, new weekly working-set minimum for that muscle>,
      "newMax": <integer, new weekly working-set maximum for that muscle>,
      "rationale": "<one sentence, must cite a specific recovery/plateau/overreach reason from the data, never just 'you're not hitting the current target'>"
    }
  ]
}

Only propose edits when volume is clearly below or above the target range for a muscle, or when an exercise's set count, load, or rest period should change based on trend/recovery data. If nothing needs to change, return an empty array for that field.

Constraints:
- Touch at most ${MAX_DRAFT_ROUTINES} distinct routines (by routineId) across all of proposedEdits — pick the ones that matter most.
- Never propose edits for routines or exercise indices not present in the provided list.
- proposedTargetEdits should be rare — only propose a target-range change when the data shows a genuine, sustained mismatch (e.g. consistently overreaching without recovery, or a plateau suggesting the range itself is wrong), never merely to match how much the client actually did that week.`;
}

function buildUserPrompt(data: WeeklyData): string {
  const lines: string[] = [];

  lines.push(buildClientProfileSection(data.profile, data.musclePriorities));

  lines.push(`\n## This week's actual performance (since ${data.weekStart.slice(0, 10)}, week starting Monday)`);
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

  lines.push(`\n## Favorited routines structure (for proposing set/weight/rest edits)`);
  for (const r of data.favorites) {
    lines.push(`### Routine "${r.title}" (routineId: ${r.id})`);
    const exercises = [...(r.exercises ?? [])].sort((a, b) => a.index - b.index);
    exercises.forEach((ex: RoutineExercise) => {
      const working = ex.sets.filter((s) => s.type !== "warmup");
      const topWeight = working.length ? Math.max(...working.map((s) => s.weight_kg ?? 0)) : null;
      lines.push(
        `  [${ex.index}] ${ex.title} (${muscleFor(ex.title)}) — ${working.length} working sets, top weight ${topWeight ?? "?"}kg, rest ${ex.rest_seconds ?? "?"}s`
      );
    });
  }

  return lines.join("\n");
}

type RawProposedEdit = Omit<ProposedEdit, "id" | "status">;
type RawProposedTargetEdit = Omit<ProposedTargetEdit, "id" | "status" | "currentMin" | "currentMax">;

function parseReviewJson(text: string): { review: string; proposedEdits: RawProposedEdit[]; proposedTargetEdits: RawProposedTargetEdit[] } {
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

async function callCoachModel(systemPrompt: string, userPrompt: string, anthropicApiKey: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      system: systemPrompt,
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

  return text;
}

function buildProposals(
  parsed: { proposedEdits: RawProposedEdit[]; proposedTargetEdits: RawProposedTargetEdit[] },
  favorites: Routine[],
  targets: VolumeTargets
): { proposedEdits: ProposedEdit[]; proposedTargetEdits: ProposedTargetEdit[] } {
  const favoriteById = new Map(favorites.map((r) => [r.id, r]));
  const validatedEdits = (parsed.proposedEdits ?? [])
    .map((edit) => {
      const routine = favoriteById.get(edit.routineId);
      const ex = routine?.exercises?.find((e) => e.index === edit.exerciseIndex);
      return { edit, ex };
    })
    .filter(({ edit, ex }): boolean => {
      if (!ex || ex.title !== edit.exerciseTitle) return false;
      if (edit.action === "add_set" || edit.action === "remove_set") return typeof edit.count === "number";
      if (edit.action === "change_weight") return typeof edit.newWeightKg === "number";
      if (edit.action === "change_rest_seconds") return typeof edit.newRestSeconds === "number";
      return false;
    })
    .map(({ edit, ex }) => {
      const workingSets = ex!.sets.filter((s) => s.type !== "warmup");
      const before = { workingSets: workingSets.length, topWeightKg: topWeight(workingSets), restSeconds: ex!.rest_seconds };
      return { ...edit, before };
    });

  // Server-side backstop for the "at most MAX_DRAFT_ROUTINES" prompt instruction —
  // keep edits only for the first N distinct routines, in the order they appeared.
  const allowedRoutineIds = new Set<string>();
  for (const edit of validatedEdits) {
    if (allowedRoutineIds.size >= MAX_DRAFT_ROUTINES && !allowedRoutineIds.has(edit.routineId)) continue;
    allowedRoutineIds.add(edit.routineId);
  }
  const proposedEdits: ProposedEdit[] = validatedEdits
    .filter((edit) => allowedRoutineIds.has(edit.routineId))
    .map((edit) => ({ ...edit, id: crypto.randomUUID(), status: "pending" as const }));

  const proposedTargetEdits: ProposedTargetEdit[] = (parsed.proposedTargetEdits ?? [])
    .filter((edit) => targets[edit.muscle] && typeof edit.newMin === "number" && typeof edit.newMax === "number")
    .map((edit) => ({
      ...edit,
      currentMin: targets[edit.muscle].min,
      currentMax: targets[edit.muscle].max,
      id: crypto.randomUUID(),
      status: "pending" as const,
    }));

  return { proposedEdits, proposedTargetEdits };
}

export async function generateWeeklyReview(
  userId: string,
  hevyApiKey: string,
  anthropicApiKey: string
): Promise<{ review: string; proposedEdits: ProposedEdit[]; proposedTargetEdits: ProposedTargetEdit[] }> {
  const data = await gatherWeeklyData(userId, hevyApiKey);
  const text = await callCoachModel(buildSystemPrompt(), buildUserPrompt(data), anthropicApiKey);
  const parsed = parseReviewJson(text);
  const { proposedEdits, proposedTargetEdits } = buildProposals(parsed, data.favorites, data.targets);
  return { review: parsed.review, proposedEdits, proposedTargetEdits };
}

type RoutinePlanData = {
  favorites: Routine[];
  planVolume: { muscle: string; sets: number }[];
  targets: VolumeTargets;
  profile: TrainingProfile;
  musclePriorities: MusclePriorities;
};

async function gatherRoutinePlanData(userId: string, hevyApiKey: string): Promise<RoutinePlanData> {
  const supabase = await createClient();
  const [allRoutines, { data: favoriteRows }, targets, profile, musclePriorities] = await Promise.all([
    fetchAllRoutines(hevyApiKey),
    supabase.from("favorite_routines").select("routine_id").eq("user_id", userId),
    getVolumeTargets(userId),
    getTrainingProfile(userId),
    getMusclePriorities(userId),
  ]);
  const favoriteIds = new Set((favoriteRows ?? []).map((r) => r.routine_id));
  const favorites: Routine[] = allRoutines
    .filter((r) => favoriteIds.has(r.id))
    .map((r) => ({ ...r, is_favorite: true }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return { favorites, planVolume: computePlanVolume(favorites), targets, profile, musclePriorities };
}

function buildRoutinePlanSystemPrompt(): string {
  return `${ANTI_HALLUCINATION_PREAMBLE}You are an evidence-based strength & hypertrophy coach reviewing the DESIGN of a client's favorited/starred weekly routines — not their actual training performance. You are NOT given any session logs, workout history, or adherence data, so never comment on adherence, consistency, or what the client "actually did" this week — only on whether the program AS WRITTEN is well-designed.

Ground every recommendation in established resistance-training program-design consensus:
${VOLUME_LANDMARKS_PRINCIPLE} Evaluate the planned weekly volume per muscle (summed across all favorited routines) against the client's target ranges through that same lens.
- Training frequency of at least ~2x/week per muscle group for hypertrophy — check whether the favorited routines, taken together, hit each major muscle group often enough.
- Set/rest structure: roughly 2-3 minutes rest for compound/multi-joint lifts, roughly 60-90 seconds for single-joint/isolation accessory work (Schoenfeld & Grgic).
- Balanced exercise selection (e.g. push/pull balance, no single muscle group left with zero direct or indirect volume across the whole plan).
${PERSONALIZATION_PRINCIPLE}

Do NOT invent specific fake study citations, authors, or statistics you are not confident about. Refer to general, well-established consensus rather than fabricated sources. Do not give "bro science" advice.

You will be given: the client's profile (goal, experience level, training days/week, session time budget, and any notes), their current weekly volume-target range per muscle, the combined planned weekly volume per muscle across all favorited routines, and the exact structure of each favorited routine (with exercise indices, current working-set counts, weights, and rest periods) so you can propose concrete structural changes.

Respond with ONLY a single JSON object (no markdown fences, no prose outside the JSON) matching this shape:
{
  "review": "<markdown-formatted routine-design review: volume balance per muscle vs targets, frequency coverage, set/rest structure issues, and concrete recommendations — no comments on adherence or actual performance since none was provided>",
  "proposedEdits": [
    {
      "routineId": "<exact routineId from the provided routine list>",
      "routineTitle": "<exact routine title>",
      "exerciseIndex": <exact integer index from the provided exercise list for that routine>,
      "exerciseTitle": "<exact exercise title at that index>",
      "action": "add_set" | "remove_set" | "change_weight" | "change_rest_seconds",
      "count": <integer, required for add_set/remove_set: how many sets to add or remove>,
      "newWeightKg": <number, required for change_weight: the new working-set weight in kg>,
      "newRestSeconds": <integer, required for change_rest_seconds: the new rest period in seconds>,
      "rationale": "<one sentence, tied to volume landmarks, frequency, or rest-interval principles>"
    }
  ],
  "proposedTargetEdits": [
    {
      "muscle": "<exact muscle key from the provided target list>",
      "newMin": <integer, new weekly working-set minimum for that muscle>,
      "newMax": <integer, new weekly working-set maximum for that muscle>,
      "rationale": "<one sentence, must cite a specific structural reason from the data, never just 'the plan doesn't match the current target'>"
    }
  ]
}

Only propose edits when planned volume is clearly below or above the target range for a muscle, or when set count, weight, or rest period should change based on program-design principles. If nothing needs to change, return an empty array for that field.

Constraints:
- Touch at most ${MAX_DRAFT_ROUTINES} distinct routines (by routineId) across all of proposedEdits — pick the ones that matter most.
- Never propose edits for routines or exercise indices not present in the provided list.
- proposedTargetEdits should be rare — only propose a target-range change when the plan's structure itself strongly suggests the range is wrong, never merely to match what's currently planned.`;
}

function buildRoutinePlanUserPrompt(data: RoutinePlanData): string {
  const lines: string[] = [];

  lines.push(buildClientProfileSection(data.profile, data.musclePriorities));

  lines.push(`\n## Combined planned weekly volume (from favorited/starred routines) per muscle vs. target`);
  const planByMuscle = new Map(data.planVolume.map((v) => [v.muscle, v.sets]));
  const allMuscles = Array.from(new Set([...Object.keys(data.targets), ...planByMuscle.keys()]));
  for (const muscle of allMuscles) {
    const target = data.targets[muscle];
    lines.push(`- ${muscle}: ${planByMuscle.get(muscle) ?? 0} sets planned (target ${target ? `${target.min}-${target.max}` : "n/a"})`);
  }

  lines.push(`\n## Favorited routines structure`);
  for (const r of data.favorites) {
    lines.push(`### Routine "${r.title}" (routineId: ${r.id})`);
    const exercises = [...(r.exercises ?? [])].sort((a, b) => a.index - b.index);
    exercises.forEach((ex: RoutineExercise) => {
      const working = ex.sets.filter((s) => s.type !== "warmup");
      const topWeight = working.length ? Math.max(...working.map((s) => s.weight_kg ?? 0)) : null;
      lines.push(
        `  [${ex.index}] ${ex.title} (${muscleFor(ex.title)}) — ${working.length} working sets, top weight ${topWeight ?? "?"}kg, rest ${ex.rest_seconds ?? "?"}s`
      );
    });
  }

  return lines.join("\n");
}

export async function generateRoutinePlanReview(
  userId: string,
  hevyApiKey: string,
  anthropicApiKey: string
): Promise<{ review: string; proposedEdits: ProposedEdit[]; proposedTargetEdits: ProposedTargetEdit[] }> {
  const data = await gatherRoutinePlanData(userId, hevyApiKey);
  const text = await callCoachModel(buildRoutinePlanSystemPrompt(), buildRoutinePlanUserPrompt(data), anthropicApiKey);
  const parsed = parseReviewJson(text);
  const { proposedEdits, proposedTargetEdits } = buildProposals(parsed, data.favorites, data.targets);
  return { review: parsed.review, proposedEdits, proposedTargetEdits };
}

function emptySet(): HevySetUpdate {
  return { type: "normal", weight_kg: null, reps: null, distance_meters: null, duration_seconds: null, custom_metric: null };
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

function topWeight(sets: HevySetUpdate[]): number | null {
  const weighted = sets.filter((s) => s.weight_kg != null);
  return weighted.length ? Math.max(...weighted.map((s) => Number(s.weight_kg))) : null;
}

export type ExerciseDiff = {
  exerciseIndex: number;
  exerciseTitle: string;
  before: { workingSets: number; topWeightKg: number | null; restSeconds: number | null };
  after: { workingSets: number; topWeightKg: number | null; restSeconds: number | null };
  rationales: string[];
};

export type RoutineDraft = {
  routineId: string;
  routineTitle: string;
  exerciseDiffs: ExerciseDiff[];
  payload: { title: string; notes: string | null; exercises: HevyExerciseUpdate[] };
};

// Builds the full replacement payload Hevy's PUT /v1/routines/{id} expects,
// applying every pending edit for this one routine (across possibly several
// exercises, and possibly several edits on the same exercise) on top of the
// live-fetched routine, passing unchanged exercises through as-is (the
// endpoint replaces the whole routine body). Also returns a per-exercise
// before/after view for the draft-compare UI.
export function buildRoutineDraft(routine: Routine, edits: ProposedEdit[]): RoutineDraft {
  const exercises = [...(routine.exercises ?? [])].sort((a, b) => a.index - b.index);
  const editsByExercise = new Map<number, ProposedEdit[]>();
  for (const edit of edits) {
    if (!editsByExercise.has(edit.exerciseIndex)) editsByExercise.set(edit.exerciseIndex, []);
    editsByExercise.get(edit.exerciseIndex)!.push(edit);
  }

  const exerciseDiffs: ExerciseDiff[] = [];

  const updatedExercises: HevyExerciseUpdate[] = exercises.map((ex: RoutineExercise) => {
    const exerciseEdits = editsByExercise.get(ex.index);
    let sets = ex.sets.map(cleanSet);
    let restSeconds = ex.rest_seconds;

    if (exerciseEdits && exerciseEdits.length > 0) {
      if (exerciseEdits.some((e) => e.exerciseTitle !== ex.title)) {
        throw new Error("This routine changed since the review was generated — regenerate a new review before applying.");
      }

      const beforeWorking = sets.filter((s) => s.type !== "warmup");
      const before = { workingSets: beforeWorking.length, topWeightKg: topWeight(beforeWorking), restSeconds };

      for (const edit of exerciseEdits) {
        if (edit.action === "add_set") {
          const template = sets[sets.length - 1] ?? emptySet();
          for (let i = 0; i < (edit.count ?? 0); i++) sets.push({ ...template });
        } else if (edit.action === "remove_set") {
          const removeCount = Math.min(edit.count ?? 0, Math.max(0, sets.length - 1));
          sets = sets.slice(0, sets.length - removeCount);
        } else if (edit.action === "change_weight" && edit.newWeightKg != null) {
          sets = sets.map((s) => (s.type === "warmup" ? s : { ...s, weight_kg: edit.newWeightKg! }));
        } else if (edit.action === "change_rest_seconds" && edit.newRestSeconds != null) {
          restSeconds = edit.newRestSeconds;
        }
      }

      const afterWorking = sets.filter((s) => s.type !== "warmup");
      exerciseDiffs.push({
        exerciseIndex: ex.index,
        exerciseTitle: ex.title,
        before,
        after: { workingSets: afterWorking.length, topWeightKg: topWeight(afterWorking), restSeconds },
        rationales: exerciseEdits.map((e) => e.rationale),
      });
    }

    return {
      exercise_template_id: ex.exercise_template_id,
      superset_id: ex.superset_id,
      rest_seconds: restSeconds,
      notes: ex.notes,
      sets,
    };
  });

  return {
    routineId: routine.id,
    routineTitle: routine.title,
    exerciseDiffs,
    payload: { title: routine.title, notes: routine.notes ?? null, exercises: updatedExercises },
  };
}
