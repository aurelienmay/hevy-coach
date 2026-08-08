import { createClient } from "@/lib/supabase/server";
import {
  getUser,
  getVolumeTargetOverrides,
  getTrainingProfile,
  getMusclePriorities,
  getNormalTrainingWeek,
  getScheduleExceptions,
} from "@/lib/currentUser";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ needsKey?: string; needsAnthropicKey?: string }>;
}) {
  const { needsKey, needsAnthropicKey } = await searchParams;
  const user = await getUser();
  const supabase = await createClient();

  const [{ data }, overrides, profile, priorities, normalTrainingWeek, scheduleExceptions] = await Promise.all([
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
  ]);

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Settings</h1>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
        Your API keys and weekly volume targets — used across the whole dashboard.
      </p>

      {needsKey && (
        <p style={{ color: "#f7b84f", fontSize: 13, marginBottom: 20 }}>
          Add your Hevy API key below to start using the dashboard.
        </p>
      )}
      {needsAnthropicKey && (
        <p style={{ color: "#f7b84f", fontSize: 13, marginBottom: 20 }}>
          Add your own Anthropic API key below to use the AI Coach.
        </p>
      )}

      <SettingsForm
        initialApiKey={data?.hevy_api_key ?? ""}
        initialAnthropicApiKey={data?.anthropic_api_key ?? ""}
        initialOverrides={overrides}
        initialProfile={profile}
        initialPriorities={priorities}
        initialNormalTrainingWeek={normalTrainingWeek}
        initialScheduleExceptions={scheduleExceptions}
        needsKey={!!needsKey}
        needsAnthropicKey={!!needsAnthropicKey}
      />
    </main>
  );
}
