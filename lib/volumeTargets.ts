// Rough weekly working-set targets per muscle group, based on common
// hypertrophy training guidelines (roughly 10-20 sets/week for most muscles,
// less for smaller/assistance muscles). Used as the fallback when a user
// hasn't customized their own targets in /settings.
export const DEFAULT_VOLUME_TARGETS: Record<string, { min: number; max: number }> = {
  chest: { min: 10, max: 20 },
  back: { min: 10, max: 20 },
  shoulders: { min: 10, max: 20 },
  quads: { min: 10, max: 20 },
  biceps: { min: 8, max: 15 },
  triceps: { min: 8, max: 15 },
  hamstrings: { min: 8, max: 15 },
  glutes: { min: 8, max: 15 },
  calves: { min: 8, max: 15 },
  abs: { min: 8, max: 15 },
  forearms: { min: 6, max: 10 },
  lower_back: { min: 6, max: 10 },
};

export const EXCLUDED_MUSCLES = ["cardio", "other"];
