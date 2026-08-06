import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VOLUME_TARGETS } from "@/lib/volumeTargets";

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

export async function getVolumeTargets(userId: string): Promise<VolumeTargets> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("volume_targets")
    .eq("user_id", userId)
    .maybeSingle();

  const overrides = (data?.volume_targets as VolumeTargets | null) ?? {};
  return { ...DEFAULT_VOLUME_TARGETS, ...overrides };
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
