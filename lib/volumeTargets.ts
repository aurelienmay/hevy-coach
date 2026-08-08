import type { ExperienceLevel, Goal, MusclePriorities } from "@/lib/trainingProfile";
import { HYPERTROPHY_VOLUME_LANDMARKS, PROVISIONAL_VOLUME_LANDMARKS } from "@/lib/trainingReference";

export const EXCLUDED_MUSCLES = ["cardio", "other"];

// Hypertrophy weekly working-set targets, derived from the user's supplied
// Evidence-Based Training Reference doc (lib/trainingReference.ts) — the
// single canonical source for these numbers. min = MEV, max = top-of-MAV.
// The three "not established" muscles (abs/forearms/lower_back) fall back to
// a clearly provisional, non-doc-sourced range from the same file.
const HYPERTROPHY_TARGETS: Record<string, { min: number; max: number }> = Object.fromEntries(
  Object.entries(HYPERTROPHY_VOLUME_LANDMARKS).map(([muscle, entry]) => [
    muscle,
    "established" in entry && entry.established === false
      ? PROVISIONAL_VOLUME_LANDMARKS[muscle]
      : { min: (entry as { min: number }).min, max: (entry as { max: number }).max },
  ])
);

// Strength/fat_loss/general_fitness landmarks below are NOT yet sourced from
// a reviewed reference doc like hypertrophy now is — they're this app's own
// earlier [Inference]-style approximations, kept as-is until a matching
// reference doc exists for these goals too. Each uses the fuller
// MV/MEV/MAV/MRV shape (unlike hypertrophy's doc-given MEV/MAV-only shape).
type VolumeLandmarks = { mv: number; mev: number; mav: number; mrv: number };

// Strength work builds most of its size/strength stimulus from a handful of
// heavy compounds, so it needs far fewer total sets per muscle than a
// hypertrophy-specialized block to sit at the same relative landmark.
const STRENGTH_LANDMARKS: Record<string, VolumeLandmarks> = {
  chest: { mv: 3, mev: 5, mav: 10, mrv: 14 },
  back: { mv: 4, mev: 6, mav: 12, mrv: 16 },
  shoulders: { mv: 3, mev: 5, mav: 10, mrv: 14 },
  quads: { mv: 4, mev: 6, mav: 10, mrv: 14 },
  biceps: { mv: 2, mev: 4, mav: 8, mrv: 10 },
  triceps: { mv: 2, mev: 4, mav: 8, mrv: 10 },
  hamstrings: { mv: 2, mev: 4, mav: 8, mrv: 10 },
  glutes: { mv: 2, mev: 4, mav: 8, mrv: 10 },
  calves: { mv: 2, mev: 4, mav: 8, mrv: 10 },
  abs: { mv: 0, mev: 4, mav: 8, mrv: 12 },
  forearms: { mv: 1, mev: 2, mav: 5, mrv: 8 },
  lower_back: { mv: 1, mev: 2, mav: 5, mrv: 8 },
};

// Fat loss and general fitness aren't primarily driven by set count (diet and
// conditioning do most of the work), so both use a moderate window below the
// full hypertrophy landmarks rather than chasing MAV/MRV.
const FAT_LOSS_LANDMARKS: Record<string, VolumeLandmarks> = {
  chest: { mv: 3, mev: 6, mav: 12, mrv: 18 },
  back: { mv: 4, mev: 8, mav: 14, mrv: 20 },
  shoulders: { mv: 3, mev: 6, mav: 12, mrv: 18 },
  quads: { mv: 4, mev: 6, mav: 12, mrv: 16 },
  biceps: { mv: 3, mev: 5, mav: 10, mrv: 14 },
  triceps: { mv: 3, mev: 5, mav: 10, mrv: 14 },
  hamstrings: { mv: 3, mev: 5, mav: 10, mrv: 14 },
  glutes: { mv: 3, mev: 5, mav: 10, mrv: 14 },
  calves: { mv: 3, mev: 5, mav: 10, mrv: 14 },
  abs: { mv: 0, mev: 5, mav: 12, mrv: 16 },
  forearms: { mv: 2, mev: 3, mav: 6, mrv: 9 },
  lower_back: { mv: 2, mev: 3, mav: 6, mrv: 9 },
};

const GENERAL_FITNESS_LANDMARKS: Record<string, VolumeLandmarks> = {
  chest: { mv: 3, mev: 5, mav: 10, mrv: 15 },
  back: { mv: 4, mev: 6, mav: 12, mrv: 17 },
  shoulders: { mv: 3, mev: 5, mav: 10, mrv: 15 },
  quads: { mv: 3, mev: 5, mav: 10, mrv: 14 },
  biceps: { mv: 2, mev: 4, mav: 8, mrv: 12 },
  triceps: { mv: 2, mev: 4, mav: 8, mrv: 12 },
  hamstrings: { mv: 2, mev: 4, mav: 8, mrv: 12 },
  glutes: { mv: 2, mev: 4, mav: 8, mrv: 12 },
  calves: { mv: 2, mev: 4, mav: 8, mrv: 12 },
  abs: { mv: 0, mev: 4, mav: 10, mrv: 14 },
  forearms: { mv: 1, mev: 2, mav: 5, mrv: 8 },
  lower_back: { mv: 1, mev: 2, mav: 5, mrv: 8 },
};

const NON_HYPERTROPHY_GOAL_LANDMARKS: Record<Exclude<Goal, "hypertrophy">, Record<string, VolumeLandmarks>> = {
  strength: STRENGTH_LANDMARKS,
  fat_loss: FAT_LOSS_LANDMARKS,
  general_fitness: GENERAL_FITNESS_LANDMARKS,
};

// Stable list of every muscle the app tracks by default, independent of any
// user's goal/priority choices — used to render a full, consistent row list
// in Settings even for muscles the user has currently marked "ignore".
export const ALL_MUSCLES = Object.keys(HYPERTROPHY_TARGETS);

// Back-compat export: the old flat {min,max} shape some callers/display code
// still expect for a plain "what's a reasonable hypertrophy target" number.
export const DEFAULT_VOLUME_TARGETS: Record<string, { min: number; max: number }> = HYPERTROPHY_TARGETS;

// [Inference] — the reference doc only establishes the MEV-to-top-of-MAV
// "normal" training range; it doesn't itself quantify a maintenance or focus
// sub-window. These proportions are this app's own reasoned extension, not
// doc-sourced, and are hard-bounded by the doc's own min (MEV) / max
// (top-of-MAV) — "focus" can never exceed the documented ceiling, and
// "maintain" always sits below MEV rather than in the growth-effective zone.
function hypertrophyWindow(
  range: { min: number; max: number },
  priority: "maintain" | "normal" | "focus"
): { min: number; max: number } {
  if (priority === "maintain") {
    return { min: Math.max(1, Math.round(range.min * 0.5)), max: range.min };
  }
  if (priority === "focus") {
    const span = range.max - range.min;
    return { min: Math.round(range.min + span * 0.6), max: range.max };
  }
  return range;
}

// Same priority-window concept as hypertrophyWindow, for the four-anchor
// (MV/MEV/MAV/MRV) shape the non-hypertrophy goal tables still use: MV-MEV
// is "just enough to keep it, not to grow it," MEV-MAV is the normal
// productive training range, and MAV-MRV is "push it as hard as is still
// recoverable" — the ceiling for "focus" is still MRV, never beyond it.
function landmarkWindow(l: VolumeLandmarks, priority: "maintain" | "normal" | "focus"): { min: number; max: number } {
  if (priority === "maintain") return { min: l.mv, max: l.mev };
  if (priority === "focus") return { min: l.mav, max: l.mrv };
  return { min: l.mev, max: l.mav };
}

// Training age shifts *where within that window* a lifter should sit, rather
// than scaling the window itself: beginners get less out of (and recover
// less from) volume near the top of a landmark window, so they're nudged
// toward its lower portion; advanced lifters can productively use more of
// it, so they're nudged toward the top. Crucially this only interpolates
// inside the already-bounded [min, max] passed in — it can never push a
// range below that window's own floor or above its own ceiling, unlike a
// multiplier stacked on top of priority would.
function experienceAdjust(range: { min: number; max: number }, experienceLevel: ExperienceLevel): { min: number; max: number } {
  const span = range.max - range.min;
  if (experienceLevel === "beginner") {
    return { min: range.min, max: Math.max(range.min + 2, Math.round(range.min + span * 0.6)) };
  }
  if (experienceLevel === "advanced") {
    return { min: Math.min(range.max - 2, Math.round(range.min + span * 0.3)), max: range.max };
  }
  return range;
}

// Computes the weekly working-set target range per muscle for a given goal/
// experience level, further shaped per-muscle by the user's stated
// priorities (e.g. "maintain" chest, "focus" biceps/triceps). For the
// hypertrophy goal, every number traces back to lib/trainingReference.ts
// (the user's reviewed evidence doc) or is explicitly marked as this app's
// own inference on top of it — never from stacking independent multipliers,
// so a range can never exceed that muscle's own documented ceiling regardless
// of experience/priority combination. Non-hypertrophy goals use their own
// (not yet doc-reviewed) four-anchor tables. A muscle marked "ignore" is
// dropped from the result entirely — no target, no under/over-target
// flagging anywhere downstream. Falls back to hypertrophy/intermediate/
// normal defaults when goal/experience/priority are missing. Manual
// per-muscle overrides in /settings win over the numeric range, but never
// resurrect an "ignore"d muscle (see getVolumeTargets in lib/currentUser.ts).
export function defaultVolumeTargetsFor(
  goal?: Goal,
  experienceLevel?: ExperienceLevel,
  musclePriorities?: MusclePriorities
): Record<string, { min: number; max: number }> {
  const experience = experienceLevel ?? "intermediate";
  const result: Record<string, { min: number; max: number }> = {};

  if ((goal ?? "hypertrophy") === "hypertrophy") {
    for (const [muscle, range] of Object.entries(HYPERTROPHY_TARGETS)) {
      const priority = musclePriorities?.[muscle] ?? "normal";
      if (priority === "ignore") continue;
      result[muscle] = experienceAdjust(hypertrophyWindow(range, priority), experience);
    }
    return result;
  }

  const landmarks = NON_HYPERTROPHY_GOAL_LANDMARKS[goal as Exclude<Goal, "hypertrophy">];
  for (const [muscle, l] of Object.entries(landmarks)) {
    const priority = musclePriorities?.[muscle] ?? "normal";
    if (priority === "ignore") continue;
    result[muscle] = experienceAdjust(landmarkWindow(l, priority), experience);
  }
  return result;
}
