// Lets each user pick which Claude tier powers their AI Coach calls, so they
// can trade latency/cost against reasoning quality themselves rather than
// having it hardcoded. Sonnet is the default: materially better than Haiku
// at following the coach's multi-constraint prompt rules (e.g. cutting
// isolation before compound work when trimming volume), while staying fast
// and cheap enough that cost is a non-issue for a once-or-twice-a-week call.
export type CoachModelTier = "haiku" | "sonnet" | "opus";

export const COACH_MODELS: CoachModelTier[] = ["haiku", "sonnet", "opus"];

export const DEFAULT_COACH_MODEL: CoachModelTier = "sonnet";

export const COACH_MODEL_IDS: Record<CoachModelTier, string> = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-5",
  opus: "claude-opus-5",
};

// Haiku 4.5 doesn't support the effort parameter (errors if sent). Sonnet 5
// and Opus 5 both run adaptive thinking by default -- "medium" effort keeps
// latency close to Haiku's for this single-JSON-response workload while
// still getting the reasoning-depth benefit over Haiku.
export const COACH_MODEL_EFFORT: Record<CoachModelTier, "low" | "medium" | "high" | undefined> = {
  haiku: undefined,
  sonnet: "medium",
  opus: "medium",
};

export const COACH_MODEL_LABELS: Record<CoachModelTier, string> = {
  haiku: "Haiku (fastest, cheapest)",
  sonnet: "Sonnet (recommended)",
  opus: "Opus (most capable)",
};

// Rough per-generation cost at typical prompt/response sizes for this app's
// coach calls (a few thousand input tokens, ~1-1.5k output tokens) -- shown
// in Settings so "switch to lower/higher" is an informed choice, not a guess.
export const COACH_MODEL_COST_HINTS: Record<CoachModelTier, string> = {
  haiku: "~$0.01 per generation",
  sonnet: "~$0.02 per generation",
  opus: "~$0.04 per generation",
};

export const COACH_MODEL_DESCRIPTIONS: Record<CoachModelTier, string> = {
  haiku: "Fast and cheap, but less reliable at balancing several rules at once (e.g. session splits, volume trade-offs).",
  sonnet: "Best balance of reasoning quality, speed, and cost for weekly reviews and plan adaptation.",
  opus: "Most capable reasoning, at extra latency and cost -- try this if Sonnet's output still isn't convincing.",
};

export function isCoachModelTier(value: unknown): value is CoachModelTier {
  return value === "haiku" || value === "sonnet" || value === "opus";
}

export function resolveCoachModel(tier: CoachModelTier): { modelId: string; effort?: "low" | "medium" | "high" } {
  return { modelId: COACH_MODEL_IDS[tier], effort: COACH_MODEL_EFFORT[tier] };
}
