// Shape guard for the one API request field with real internal structure
// (volume_targets); everything else at the API boundaries is simple enough
// to check inline with typeof.
type VolumeTargetEntry = { min: number; max: number };

function isVolumeTargetEntry(value: unknown): value is VolumeTargetEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.min === "number" &&
    typeof entry.max === "number" &&
    entry.min >= 0 &&
    entry.max >= entry.min
  );
}

export function isVolumeTargets(value: unknown): value is Record<string, VolumeTargetEntry> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(isVolumeTargetEntry);
}

const GOALS = ["hypertrophy", "strength", "fat_loss", "general_fitness"];
const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"];

export function isTrainingProfile(value: unknown): value is {
  goal: string;
  experienceLevel: string;
  daysPerWeek: number;
  sessionMinutes: number;
  notes: string;
} {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.goal === "string" &&
    GOALS.includes(p.goal) &&
    typeof p.experienceLevel === "string" &&
    EXPERIENCE_LEVELS.includes(p.experienceLevel) &&
    typeof p.daysPerWeek === "number" &&
    p.daysPerWeek >= 1 &&
    p.daysPerWeek <= 7 &&
    typeof p.sessionMinutes === "number" &&
    p.sessionMinutes > 0 &&
    typeof p.notes === "string" &&
    p.notes.length <= 2000
  );
}

const MUSCLE_PRIORITIES = ["maintain", "normal", "focus", "ignore"];

export function isMusclePriorities(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === "string" && MUSCLE_PRIORITIES.includes(v));
}
