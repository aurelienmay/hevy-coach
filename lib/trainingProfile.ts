export type Goal = "hypertrophy" | "strength" | "fat_loss" | "general_fitness";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type TrainingProfile = {
  goal: Goal;
  experienceLevel: ExperienceLevel;
  daysPerWeek: number; // 1-7
  sessionMinutes: number; // typical session length budget
  notes: string; // free text: injuries, equipment, preferences
};

export const DEFAULT_TRAINING_PROFILE: TrainingProfile = {
  goal: "hypertrophy",
  experienceLevel: "intermediate",
  daysPerWeek: 4,
  sessionMinutes: 60,
  notes: "",
};

export const GOALS: Goal[] = ["hypertrophy", "strength", "fat_loss", "general_fitness"];
export const EXPERIENCE_LEVELS: ExperienceLevel[] = ["beginner", "intermediate", "advanced"];

export const GOAL_LABELS: Record<Goal, string> = {
  hypertrophy: "Hypertrophy (muscle growth)",
  strength: "Strength",
  fat_loss: "Fat loss",
  general_fitness: "General fitness",
};

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  beginner: "Beginner (<1 year)",
  intermediate: "Intermediate (1-3 years)",
  advanced: "Advanced (3+ years)",
};

// Per-muscle emphasis: lets a user say e.g. "maintain chest, focus on arms,
// ignore calves entirely" without having to hand-pick set-count numbers
// themselves. "ignore" drops the muscle from volume tracking altogether
// (no target, no under/over-target flagging, no coach commentary on it).
export type MusclePriority = "maintain" | "normal" | "focus" | "ignore";
export type MusclePriorities = Record<string, MusclePriority>;

export const MUSCLE_PRIORITIES: MusclePriority[] = ["maintain", "normal", "focus", "ignore"];

export const MUSCLE_PRIORITY_LABELS: Record<MusclePriority, string> = {
  maintain: "Maintain",
  normal: "Normal",
  focus: "Focus",
  ignore: "Ignore",
};
