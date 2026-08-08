import type { ExperienceLevel, Goal, MusclePriorities } from "@/lib/trainingProfile";

// Per-muscle weekly working-set "volume landmarks" — the framework this whole
// file is built on (Israetel et al.'s Renaissance Periodization volume
// landmarks, the same one referenced in the coach's system prompts):
//   MV  (Maintenance Volume)      minimum sets to *keep* current size/strength
//   MEV (Minimum Effective Volume) minimum sets to actually start growing
//   MAV (Maximum Adaptive Volume)  the sweet-spot range for most people, most
//                                  of the time — where the bulk of "normal"
//                                  training should live
//   MRV (Maximum Recoverable Volume) the hard ceiling — beyond this, extra
//                                  sets stop adding growth and just add
//                                  fatigue/injury risk ("junk volume")
// These are per-muscle and independent of every other muscle: deprioritizing
// one muscle (e.g. marking chest "maintain") only narrows *that* muscle's own
// landmark window, never implies more volume is warranted elsewhere.
type VolumeLandmarks = { mv: number; mev: number; mav: number; mrv: number };

export const EXCLUDED_MUSCLES = ["cardio", "other"];

// Hypertrophy-goal landmarks — the reference table every other goal is a
// variation of. Bigger, more recoverable muscle groups (back, quads,
// shoulders) tolerate higher MRVs; smaller or recovery-limited groups
// (forearms, lower back) get more conservative ceilings.
const HYPERTROPHY_LANDMARKS: Record<string, VolumeLandmarks> = {
  chest: { mv: 4, mev: 8, mav: 16, mrv: 22 },
  back: { mv: 6, mev: 10, mav: 18, mrv: 25 },
  shoulders: { mv: 4, mev: 8, mav: 16, mrv: 24 },
  quads: { mv: 6, mev: 8, mav: 16, mrv: 20 },
  biceps: { mv: 4, mev: 6, mav: 14, mrv: 20 },
  triceps: { mv: 4, mev: 6, mav: 12, mrv: 18 },
  hamstrings: { mv: 4, mev: 6, mav: 12, mrv: 16 },
  glutes: { mv: 4, mev: 6, mav: 12, mrv: 16 },
  calves: { mv: 4, mev: 6, mav: 12, mrv: 16 },
  abs: { mv: 0, mev: 6, mav: 16, mrv: 20 },
  forearms: { mv: 2, mev: 4, mav: 8, mrv: 12 },
  lower_back: { mv: 2, mev: 4, mav: 8, mrv: 12 },
};

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

const GOAL_LANDMARKS: Record<Goal, Record<string, VolumeLandmarks>> = {
  hypertrophy: HYPERTROPHY_LANDMARKS,
  strength: STRENGTH_LANDMARKS,
  fat_loss: FAT_LOSS_LANDMARKS,
  general_fitness: GENERAL_FITNESS_LANDMARKS,
};

// Stable list of every muscle the app tracks by default, independent of any
// user's goal/priority choices — used to render a full, consistent row list
// in Settings even for muscles the user has currently marked "ignore".
export const ALL_MUSCLES = Object.keys(HYPERTROPHY_LANDMARKS);

// Back-compat export: the old flat {min,max} shape some callers/display code
// still expect for a plain "what's a reasonable hypertrophy target" number,
// derived from the MEV-MAV working range (the landmark window "normal"
// priority actually trains in).
export const DEFAULT_VOLUME_TARGETS: Record<string, { min: number; max: number }> = Object.fromEntries(
  Object.entries(HYPERTROPHY_LANDMARKS).map(([muscle, l]) => [muscle, { min: l.mev, max: l.mav }])
);

// A muscle's priority selects which landmark window it's trained in: MV-MEV
// is "just enough to keep it, not to grow it," MEV-MAV is the normal
// productive training range, and MAV-MRV is "push it as hard as is still
// recoverable." Note the ceiling for "focus" is still MRV — no amount of
// extra emphasis pushes a muscle's range past what's actually recoverable.
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
// inside the already-bounded [min, max] from landmarkWindow — it can never
// push a range below MV or above MRV, unlike a multiplier stacked on top of
// priority would.
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
// priorities (e.g. "maintain" chest, "focus" biceps/triceps). Every number
// comes from a fixed, per-muscle, per-goal landmark table (see above) — never
// from stacking independent multipliers, so a range can never exceed that
// muscle's own MRV regardless of goal/experience/priority combination. A
// muscle marked "ignore" is dropped from the result entirely — no target, no
// under/over-target flagging anywhere downstream. Falls back to today's
// hypertrophy/intermediate/normal defaults when goal/experience/priority are
// missing. Manual per-muscle overrides in /settings win over the numeric
// range, but never resurrect an "ignore"d muscle (see getVolumeTargets in
// lib/currentUser.ts).
export function defaultVolumeTargetsFor(
  goal?: Goal,
  experienceLevel?: ExperienceLevel,
  musclePriorities?: MusclePriorities
): Record<string, { min: number; max: number }> {
  const landmarks = GOAL_LANDMARKS[goal ?? "hypertrophy"];

  const result: Record<string, { min: number; max: number }> = {};
  for (const [muscle, l] of Object.entries(landmarks)) {
    const priority = musclePriorities?.[muscle] ?? "normal";
    if (priority === "ignore") continue;
    const window = landmarkWindow(l, priority);
    result[muscle] = experienceAdjust(window, experienceLevel ?? "intermediate");
  }
  return result;
}
