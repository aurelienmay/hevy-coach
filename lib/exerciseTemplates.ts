import { fetchAllExerciseTemplates, type HevyExerciseTemplate } from "@/lib/hevy";

// Hevy's exercise_template muscle-group enum is finer-grained than this app's
// 12-muscle taxonomy (see lib/volumeTargets.ts) -- fold it down so volume
// targets keep working unchanged.
const HEVY_GROUP_TO_MUSCLE: Record<string, string> = {
  abdominals: "abs",
  shoulders: "shoulders",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearms",
  quadriceps: "quads",
  hamstrings: "hamstrings",
  calves: "calves",
  glutes: "glutes",
  abductors: "glutes",
  adductors: "glutes",
  lats: "back",
  upper_back: "back",
  traps: "back",
  lower_back: "lower_back",
  chest: "chest",
  cardio: "cardio",
  neck: "other",
  full_body: "other",
  other: "other",
};

// exercise_template_id -> app muscle (primary muscle group only).
export type MuscleIndex = Map<string, string>;

export function buildMuscleIndex(templates: HevyExerciseTemplate[]): MuscleIndex {
  const index: MuscleIndex = new Map();
  for (const t of templates) {
    index.set(t.id, HEVY_GROUP_TO_MUSCLE[t.primary_muscle_group] ?? "other");
  }
  return index;
}

// Defensive fallback for a set referencing a template id the fetch didn't
// return (e.g. a since-deleted custom exercise).
export function muscleForTemplate(templateId: string, index: MuscleIndex): string {
  return index.get(templateId) ?? "other";
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour -- template data changes rarely
const templateCache = new Map<string, { templates: HevyExerciseTemplate[]; expiresAt: number }>();

// Wraps fetchAllExerciseTemplates with a short-lived in-memory cache so every
// page load doesn't repaginate the full template library (built-ins + the
// user's customs, potentially several hundred entries). Resets on cold start,
// which is fine since this data changes rarely.
export async function getExerciseTemplates(apiKey: string): Promise<HevyExerciseTemplate[]> {
  const cached = templateCache.get(apiKey);
  if (cached && cached.expiresAt > Date.now()) return cached.templates;

  const templates = await fetchAllExerciseTemplates(apiKey);
  templateCache.set(apiKey, { templates, expiresAt: Date.now() + CACHE_TTL_MS });
  return templates;
}
