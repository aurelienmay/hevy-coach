// The "holy grail" — a single, tagged transcription of the user's supplied
// Evidence-Based Training Reference document. Every number below carries the
// tier the source document gave it; that tag is load-bearing, not decoration.
// lib/volumeTargets.ts (deterministic target math) and lib/coach.ts (the AI
// Coach's system prompts) both derive from this file instead of duplicating
// hand-typed numbers that could drift out of sync with each other or with
// the source document.
//
// Tiers, as defined by the source doc:
//   RCT             a direct controlled trial on that specific question
//   Meta            a meta-analysis/systematic review pooling multiple trials
//   Meta-synthesis  a synthesis drawing on multiple meta-analyses/trials
//   Framework       an applied coaching synthesis of the research (e.g. RP/
//                   Israetel), not itself a primary study
//   Inference       mechanistically reasoned from related evidence, but not
//                   directly tested — used here only where this codebase
//                   needed a number the source doc didn't itself provide
//   Not established flagged explicitly where no real data exists, rather
//                   than filled in with a plausible-sounding guess
export type EvidenceTier = "RCT" | "Meta" | "Meta-synthesis" | "Framework" | "Inference" | "Not established";

// --- §1 Rest between sets ---------------------------------------------
export const REST_GUIDANCE = {
  compound: {
    seconds: 180,
    tier: "RCT" as EvidenceTier,
    source: "Schoenfeld et al. 2016 — 3-min rest beat 1-min rest on both strength and muscle thickness (bench press/lat pulldown)",
  },
  isolation: {
    seconds: 90,
    tier: "Meta" as EvidenceTier,
    source: "Grgic et al. 2024 (Bayesian meta-analysis) — hypertrophy benefit plateaus ~90s; <60s shows a small measurable cost, >90s shows no added benefit",
  },
};

// --- §2 Rest between sessions (same muscle) -----------------------------
export const FREQUENCY_GUIDANCE = {
  minHoursSameMuscle: 48,
  maxHoursSameMuscle: 72,
  sweetSpotPerWeek: 2,
  tier: "Meta-synthesis" as EvidenceTier,
  note: "MPS in trained lifters stays meaningfully elevated ~36-48h post-session (untrained lifters may need longer). 2x/week per muscle beats 1x/week at equal volume (Schoenfeld et al. frequency meta-analysis); no clear added benefit found for frequencies beyond 2x/week once volume is equated.",
};

// --- §3 Weekly set volume (hypertrophy only — see lib/volumeTargets.ts) --
// Framework-tier synthesis of Schoenfeld dose-response data (Israetel/RP),
// not itself a primary study. min = MEV (floor), max = top-of-MAV (optimal
// ceiling before diminishing returns get steep). "back" uses the doc's
// "width/lats" line since this app tracks one combined "back" bucket rather
// than separate width/thickness sub-regions.
const HYPERTROPHY_SOURCE = "Israetel/RP synthesis of Schoenfeld dose-response volume data";

export const HYPERTROPHY_VOLUME_LANDMARKS: Record<
  string,
  { min: number; max: number; tier: "Framework"; source: string } | { established: false; note: string }
> = {
  chest: { min: 8, max: 20, tier: "Framework", source: HYPERTROPHY_SOURCE },
  back: { min: 8, max: 20, tier: "Framework", source: `${HYPERTROPHY_SOURCE} (width/lats line)` },
  shoulders: { min: 6, max: 20, tier: "Framework", source: HYPERTROPHY_SOURCE },
  biceps: { min: 6, max: 16, tier: "Framework", source: HYPERTROPHY_SOURCE },
  triceps: { min: 4, max: 14, tier: "Framework", source: HYPERTROPHY_SOURCE },
  quads: { min: 6, max: 18, tier: "Framework", source: HYPERTROPHY_SOURCE },
  hamstrings: { min: 4, max: 14, tier: "Framework", source: HYPERTROPHY_SOURCE },
  glutes: { min: 4, max: 16, tier: "Framework", source: HYPERTROPHY_SOURCE },
  calves: { min: 6, max: 16, tier: "Framework", source: HYPERTROPHY_SOURCE },
  abs: { established: false, note: "no numeric landmark found" },
  forearms: { established: false, note: "no numeric landmark found" },
  lower_back: {
    established: false,
    note: "hypertrophy dose-response research on erectors essentially doesn't exist in trained lifters; only rehab/low-back-pain literature exists; gets indirect volume from hip-hinge/pulling work",
  },
};

// Provisional-only fallback for the three "not established" muscles above,
// so Settings/tracking still has a number to display and edit. Explicitly
// NOT sourced from the reference doc — kept close to this app's prior
// shipped numbers, tagged Inference, and never claimed as settled science
// (see the coach's system prompt, which says so explicitly per-muscle).
export const PROVISIONAL_VOLUME_LANDMARKS: Record<string, { min: number; max: number }> = {
  abs: { min: 6, max: 16 },
  forearms: { min: 4, max: 10 },
  lower_back: { min: 4, max: 10 },
};

export const UNESTABLISHED_MUSCLES = Object.entries(HYPERTROPHY_VOLUME_LANDMARKS)
  .filter(([, v]) => "established" in v && v.established === false)
  .map(([muscle]) => muscle);

// --- §4 Effort (RIR) -----------------------------------------------------
export const EFFORT_GUIDANCE = {
  compound: {
    rir: "1-2",
    tier: "Meta" as EvidenceTier,
    source: "Refalo et al. 2023 — training to failure vs. stopping 1-2 reps short produces near-identical hypertrophy, but failure adds meaningfully more fatigue; compounds already carry the highest fatigue cost per set",
  },
  isolation: {
    rir: "0 (failure OK on last set(s))",
    tier: "Inference" as EvidenceTier,
    source: "lower systemic fatigue cost per set makes the added fatigue from failure less costly here",
  },
};

// --- §5 Set cap per exercise (within one session) -------------------------
export const SET_CAP_GUIDANCE = {
  compound: 3,
  isolation: 4,
  hardMax: 5,
  tier: "Meta-synthesis" as EvidenceTier,
  note: "Within-session hypertrophy keeps climbing up to ~6-8 hard sets per muscle before plateauing — 4 sets on one movement sits well inside the productive zone.",
  variationSource:
    "Fonseca et al. 2014 [Meta] — exercise variation drives more complete regional hypertrophy than piling extra sets onto one movement; past ~4 sets on a single exercise, a different exercise for the same muscle beats a 5th set of the same one",
};

// --- §6 Warm-up ------------------------------------------------------------
export const WARMUP_GUIDANCE = {
  general: {
    text: "5-10 min light cardio + dynamic mobility, every session",
    tier: "RCT" as EvidenceTier,
    source: "no significant performance difference found between general and specific warm-ups in trained lifters — standard readiness practice, not a proven performance edge; evidence specifically linking RT warm-ups to injury prevention is thin",
  },
  specificRampUp: {
    text: "2 ramp-up sets (~50% working weight x 8, then ~75-80% x 3-5) only before the first heavy compound of a session",
    tier: "RCT" as EvidenceTier,
    source: "high-load/low-volume ramps improve subsequent working-set performance more than light/high-volume ramps",
  },
  skipWhen: {
    text: "no dedicated warm-up sets for exercises re-loading an already-warm muscle/joint later in the session, or for light isolation work",
    tier: "RCT" as EvidenceTier,
    source: "no meaningful performance difference between 1-set, 2-set, or no warm-up once already warm",
  },
};

// --- §7 Exercise selection criteria ---------------------------------------
export const EXERCISE_SELECTION_CRITERIA: { rule: string; tier: EvidenceTier }[] = [
  { rule: "Prefer exercises with direct EMG/hypertrophy data confirming top activation for the specific target muscle — not just \"it's a compound\" by default.", tier: "Meta" },
  { rule: "Where a muscle has distinct regions (back = lats vs. traps/rhomboids; triceps = long head vs. lateral/medial; deltoid = anterior/lateral/posterior), use different exercises per region, not one exercise for the whole group.", tier: "Meta" },
  { rule: "Favor exercises loading the muscle at a lengthened position where stretch-mediated hypertrophy research supports it (overhead triceps extension > pushdown; incline curl > standing curl; standing calf raise > seated).", tier: "RCT" },
  { rule: "Avoid exercises where a secondary/stabilizer muscle becomes the limiting factor before the target muscle reaches real fatigue (e.g. free-standing bent-over row) — prefer supported/machine variants unless the free-weight skill transfer is itself a goal.", tier: "Meta" },
  { rule: "Prefer continuous-tension variants (cable/machine) over gravity-dependent free weights specifically at joint angles where gravity provides no resistance (e.g. cable lateral raise > dumbbell at the bottom of the rep).", tier: "Inference" },
];

// --- §8 Not yet audited — say so, don't fill in ---------------------------
export const NOT_YET_AUDITED_EXERCISE_SELECTION = [
  "chest (flat vs. incline vs. which press variant)",
  "quads (hack squat vs. leg press vs. squat variants)",
  "hamstrings / glutes exercise tier list",
];
