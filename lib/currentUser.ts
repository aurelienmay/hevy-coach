import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VOLUME_TARGETS } from "@/lib/volumeTargets";

// Middleware already guarantees a signed-in user for every non-public route,
// so this only needs to read the session, not redirect on missing auth.
export async function getUser() {
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
