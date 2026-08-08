import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { defaultVolumeTargetsFor } from "@/lib/volumeTargets";
import { DEFAULT_TRAINING_PROFILE, type TrainingProfile, type MusclePriorities } from "@/lib/trainingProfile";
import { DEFAULT_NORMAL_TRAINING_WEEK, type NormalTrainingWeek, type ScheduleException } from "@/lib/schedule";

// Middleware already contacts the Supabase Auth server to verify the JWT and
// guarantees a signed-in user for every non-public route -- it forwards the
// verified id via the x-user-id header so pages don't pay for that same
// network round-trip a second time on every navigation.
export async function getUser(): Promise<{ id: string }> {
  const userId = (await headers()).get("x-user-id");
  if (userId) return { id: userId };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

// Gets the signed-in user's saved Hevy API key, sending them to /settings
// to add one if they haven't yet.
export async function requireHevyApiKey(): Promise<{ userId: string; apiKey: string }> {
  const user = await getUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_settings")
    .select("hevy_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data?.hevy_api_key) {
    redirect("/settings?needsKey=1");
  }

  return { userId: user.id, apiKey: data.hevy_api_key };
}

// The AI Coach needs both keys: Hevy to read/write training data, Anthropic
// (each user's own) to generate the review -- so it's never billed to us.
export async function requireCoachApiKeys(): Promise<{ userId: string; hevyApiKey: string; anthropicApiKey: string }> {
  const user = await getUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_settings")
    .select("hevy_api_key, anthropic_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data?.hevy_api_key) {
    redirect("/settings?needsKey=1");
  }
  if (!data?.anthropic_api_key) {
    redirect("/settings?needsAnthropicKey=1");
  }

  return { userId: user.id, hevyApiKey: data.hevy_api_key, anthropicApiKey: data.anthropic_api_key };
}

export type VolumeTargets = Record<string, { min: number; max: number }>;

// Merges a saved training profile over the app defaults, so partially-set
// profiles (or ones saved before a field existed) still fill in sensibly.
export async function getTrainingProfile(userId: string): Promise<TrainingProfile> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("training_profile")
    .eq("user_id", userId)
    .maybeSingle();

  const saved = (data?.training_profile as Partial<TrainingProfile> | null) ?? {};
  return { ...DEFAULT_TRAINING_PROFILE, ...saved };
}

// Merges a saved per-muscle priority map over an empty default ("normal" for
// every muscle, applied implicitly by defaultVolumeTargetsFor when a muscle
// is absent from the map).
export async function getMusclePriorities(userId: string): Promise<MusclePriorities> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("muscle_priorities")
    .eq("user_id", userId)
    .maybeSingle();

  return (data?.muscle_priorities as MusclePriorities | null) ?? {};
}

// Merges a saved normal-training-week pattern over the app default (Mon-Sat).
export async function getNormalTrainingWeek(userId: string): Promise<NormalTrainingWeek> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("normal_training_week")
    .eq("user_id", userId)
    .maybeSingle();

  return (data?.normal_training_week as NormalTrainingWeek | null) ?? DEFAULT_NORMAL_TRAINING_WEEK;
}

// One-off unavailable date ranges (holidays, travel, etc.) -- defaults to
// none, unlike the other getters here there's no non-empty default to merge.
export async function getScheduleExceptions(userId: string): Promise<ScheduleException[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("schedule_exceptions")
    .eq("user_id", userId)
    .maybeSingle();

  return (data?.schedule_exceptions as ScheduleException[] | null) ?? [];
}

// A tagged pool of routines the AI Coach reuses for schedule-adapted week
// plans, exactly like favorite_routines but a separate tag -- toggled the
// same way (see app/api/routines/[id]/adapted-plan/route.ts). Order matters:
// added_at defines which "slot" (i.e. which training day of an adapted week)
// each routine fills, oldest-tagged first -- see
// app/api/coach/week-plan/push/route.ts.
export async function getAdaptedPlanRoutineIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("adapted_plan_routines")
    .select("routine_id")
    .eq("user_id", userId)
    .order("added_at", { ascending: true });

  return (data ?? []).map((row) => row.routine_id);
}

export async function addAdaptedPlanRoutine(userId: string, routineId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("adapted_plan_routines")
    .upsert({ user_id: userId, routine_id: routineId }, { onConflict: "user_id,routine_id" });
  if (error) throw error;
}

export async function removeAdaptedPlanRoutine(userId: string, routineId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("adapted_plan_routines")
    .delete()
    .eq("user_id", userId)
    .eq("routine_id", routineId);
  if (error) throw error;
}

// A tagged pool of routines to compare against the current plan (favorites),
// exactly like favorite_routines/adapted_plan_routines -- toggled the same
// way (see app/api/routines/[id]/compare-plan/route.ts).
export async function getComparePlanRoutineIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("compare_plan_routines")
    .select("routine_id")
    .eq("user_id", userId)
    .order("added_at", { ascending: true });

  return (data ?? []).map((row) => row.routine_id);
}

export async function addComparePlanRoutine(userId: string, routineId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("compare_plan_routines")
    .upsert({ user_id: userId, routine_id: routineId }, { onConflict: "user_id,routine_id" });
  if (error) throw error;
}

export async function removeComparePlanRoutine(userId: string, routineId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("compare_plan_routines")
    .delete()
    .eq("user_id", userId)
    .eq("routine_id", routineId);
  if (error) throw error;
}

export async function getVolumeTargets(userId: string): Promise<VolumeTargets> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("volume_targets, training_profile, muscle_priorities")
    .eq("user_id", userId)
    .maybeSingle();

  const profile = (data?.training_profile as Partial<TrainingProfile> | null) ?? {};
  const priorities = (data?.muscle_priorities as MusclePriorities | null) ?? {};
  const base = defaultVolumeTargetsFor(profile.goal, profile.experienceLevel, priorities);
  const overrides = (data?.volume_targets as VolumeTargets | null) ?? {};
  const merged = { ...base, ...overrides };

  // "ignore" always wins, even over a manual override saved before the
  // muscle was marked ignored — the point is to drop it from tracking.
  for (const [muscle, priority] of Object.entries(priorities)) {
    if (priority === "ignore") delete merged[muscle];
  }

  return merged;
}

// Raw manual overrides only — no computed defaults merged in. Used by Settings
// so it can tell "coach-computed" apart from "user pinned" and only ever save
// the muscles the user actually chose to override.
export async function getVolumeTargetOverrides(userId: string): Promise<VolumeTargets> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("volume_targets")
    .eq("user_id", userId)
    .maybeSingle();

  return (data?.volume_targets as VolumeTargets | null) ?? {};
}

// Merges a single muscle's new min/max into the user's volume_targets override
// jsonb, leaving every other muscle's override (or lack of one) untouched.
export async function setVolumeTargetOverride(userId: string, muscle: string, range: { min: number; max: number }): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("volume_targets")
    .eq("user_id", userId)
    .maybeSingle();

  const overrides = (data?.volume_targets as VolumeTargets | null) ?? {};
  const updated = { ...overrides, [muscle]: range };

  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, volume_targets: updated }, { onConflict: "user_id" });
  if (error) throw error;
}
