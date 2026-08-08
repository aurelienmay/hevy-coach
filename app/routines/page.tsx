import { fetchRoutine } from "@/lib/hevy";
import { requireHevyApiKey, getVolumeTargets, type VolumeTargets } from "@/lib/currentUser";
import { createClient } from "@/lib/supabase/server";
import RoutineCard, { type Routine } from "@/components/RoutineCard";
import OtherRoutines from "@/components/OtherRoutines";
import PlanVolumeSummary from "@/components/PlanVolumeSummary";
import RoutineComparison from "@/components/RoutineComparison";
import HevyError from "@/components/HevyError";
import { computePlanVolume } from "@/lib/planVolume";

export const dynamic = "force-dynamic";

// Only fetches the routines the user has starred, instead of paging through
// every routine in their Hevy account. The rest are fetched on demand by
// OtherRoutines when the user asks to browse them.
async function getFavoriteRoutines(userId: string, apiKey: string): Promise<Routine[]> {
  const supabase = await createClient();
  const { data: favoriteRows } = await supabase
    .from("favorite_routines")
    .select("routine_id")
    .eq("user_id", userId);

  const favoriteIds = (favoriteRows ?? []).map((r) => r.routine_id);
  const routines = await Promise.all(favoriteIds.map((id) => fetchRoutine(apiKey, id)));
  return routines
    .map((r) => ({ ...r, is_favorite: true }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export default async function RoutinesPage() {
  const { userId, apiKey } = await requireHevyApiKey();

  let favorites: Routine[];
  let targets: VolumeTargets;
  try {
    [favorites, targets] = await Promise.all([
      getFavoriteRoutines(userId, apiKey),
      getVolumeTargets(userId),
    ]);
  } catch (err) {
    return (
      <main>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Routines</h1>
        <HevyError error={err} />
      </main>
    );
  }
  const planVolume = computePlanVolume(favorites);

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Routines</h1>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
        Star a routine to mark it part of your current weekly plan.
      </p>

      {favorites.length === 0 ? (
        <>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Current plan</h2>
          <p style={{ color: "#888", fontSize: 13, marginBottom: 24 }}>
            No favorites yet — show other routines below and star one to add it to your plan.
          </p>
        </>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: 32,
            marginBottom: 32,
            alignItems: "start",
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Current plan</h2>
            <PlanVolumeSummary volume={planVolume} targets={targets} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 16,
              }}
            >
              {favorites.map((r) => (
                <RoutineCard key={r.id} routine={r} />
              ))}
            </div>
          </div>

          <RoutineComparison favorites={favorites} targets={targets} />
        </div>
      )}

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Other routines</h2>
      <OtherRoutines />
    </main>
  );
}
