import { createClient } from "@/lib/supabase/server";
import {
  getUser,
  getVolumeTargetOverrides,
  getTrainingProfile,
  getMusclePriorities,
  getNormalTrainingWeek,
  getScheduleExceptions,
  getCoachModel,
} from "@/lib/currentUser";
import SettingsForm from "@/components/SettingsForm";
import { decryptSecret, SecretDecryptionError } from "@/lib/secretCrypto";

// Falls back to an empty field on a real decrypt failure (wrong/rotated key,
// corrupted data) rather than crashing -- this page is where the user goes
// to fix a bad key, so it must never dead-end them. A misconfigured
// SETTINGS_ENCRYPTION_KEY (a non-SecretDecryptionError) still throws.
function decryptOrEmpty(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return decryptSecret(value);
  } catch (err) {
    if (err instanceof SecretDecryptionError) return "";
    throw err;
  }
}

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ needsKey?: string; needsAnthropicKey?: string }>;
}) {
  const { needsKey, needsAnthropicKey } = await searchParams;
  const user = await getUser();
  const supabase = await createClient();

  const [{ data }, overrides, profile, priorities, normalTrainingWeek, scheduleExceptions, coachModel] =
    await Promise.all([
      supabase
        .from("user_settings")
        .select("hevy_api_key, anthropic_api_key")
        .eq("user_id", user.id)
        .maybeSingle(),
      getVolumeTargetOverrides(user.id),
      getTrainingProfile(user.id),
      getMusclePriorities(user.id),
      getNormalTrainingWeek(user.id),
      getScheduleExceptions(user.id),
      getCoachModel(user.id),
    ]);

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Settings</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
        Your API keys and weekly volume targets — used across the whole dashboard.
      </p>

      {needsKey && (
        <p style={{ color: "var(--warning)", fontSize: 13, marginBottom: 20 }}>
          Add your Hevy API key below to start using the dashboard.
        </p>
      )}
      {needsAnthropicKey && (
        <p style={{ color: "var(--warning)", fontSize: 13, marginBottom: 20 }}>
          Add your own Anthropic API key below to use the AI Coach.
        </p>
      )}

      <SettingsForm
        initialApiKey={decryptOrEmpty(data?.hevy_api_key)}
        initialAnthropicApiKey={decryptOrEmpty(data?.anthropic_api_key)}
        initialOverrides={overrides}
        initialProfile={profile}
        initialPriorities={priorities}
        initialNormalTrainingWeek={normalTrainingWeek}
        initialScheduleExceptions={scheduleExceptions}
        initialCoachModel={coachModel}
        needsKey={!!needsKey}
        needsAnthropicKey={!!needsAnthropicKey}
      />
    </main>
  );
}
