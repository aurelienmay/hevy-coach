import { fetchRoutine, type HevyRoutine } from "@/lib/hevy";
import {
  requireHevyApiKey,
  getVolumeTargets,
  getAdaptedPlanRoutineIds,
  getComparePlanRoutineIds,
  type VolumeTargets,
} from "@/lib/currentUser";
import { createClient } from "@/lib/supabase/server";
import RoutineCard, { type Routine } from "@/components/RoutineCard";
import OtherRoutines from "@/components/OtherRoutines";
import PlanVolumeSummary from "@/components/PlanVolumeSummary";
import RoutineComparison from "@/components/RoutineComparison";
import HevyError from "@/components/HevyError";
import { computePlanVolume } from "@/lib/planVolume";
import { buildMuscleIndex, getExerciseTemplates, type MuscleIndex } from "@/lib/exerciseTemplates";

export const dynamic = "force-dynamic";

type Tags = { favoriteIds: Set<string>; adaptedIds: Set<string>; compareIds: Set<string> };

function withTags(r: HevyRoutine, tags: Tags): Routine {
  return {
    ...r,
    is_favorite: tags.favoriteIds.has(r.id),
    is_adapted_plan: tags.adaptedIds.has(r.id),
    is_compare_plan: tags.compareIds.has(r.id),
  };
}

export default async function RoutinesPage() {
  const { userId, apiKey } = await requireHevyApiKey();

  let favorites: Routine[];
  let adaptedPlan: Routine[];
  let comparePlan: Routine[];
  let targets: VolumeTargets;
  let muscleIndex: MuscleIndex;
  try {
    const supabase = await createClient();
    const [{ data: favoriteRows }, targetsResult, adaptedIds, compareIds, templates] = await Promise.all([
      supabase.from("favorite_routines").select("routine_id").eq("user_id", userId),
      getVolumeTargets(userId),
      getAdaptedPlanRoutineIds(userId),
      getComparePlanRoutineIds(userId),
      getExerciseTemplates(apiKey),
    ]);
    targets = targetsResult;
    muscleIndex = buildMuscleIndex(templates);
    const tags: Tags = {
      favoriteIds: new Set((favoriteRows ?? []).map((r) => r.routine_id)),
      adaptedIds: new Set(adaptedIds),
      compareIds: new Set(compareIds),
    };

    [favorites, adaptedPlan, comparePlan] = await Promise.all([
      Promise.all([...tags.favoriteIds].map((id) => fetchRoutine(apiKey, id))).then((rs) =>
        rs.map((r) => withTags(r, tags)).sort((a, b) => a.title.localeCompare(b.title))
      ),
      Promise.all(adaptedIds.map((id) => fetchRoutine(apiKey, id))).then((rs) => rs.map((r) => withTags(r, tags))),
      Promise.all(compareIds.map((id) => fetchRoutine(apiKey, id))).then((rs) => rs.map((r) => withTags(r, tags))),
    ]);
  } catch (err) {
    return (
      <main>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Routines</h1>
        <HevyError error={err} />
      </main>
    );
  }
  const planVolume = computePlanVolume(favorites, muscleIndex);
  const adaptedPlanVolume = computePlanVolume(adaptedPlan, muscleIndex);

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Routines</h1>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
        Star a routine (★) to mark it part of your current weekly plan. Toggle ⟳ to add it to the
        AI Coach&apos;s reusable pool for schedule-adapted weeks, or ⚖ to add it to the plan
        comparison below — a routine can carry any combination of these tags.
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

          <RoutineComparison favorites={favorites} comparePlan={comparePlan} targets={targets} muscleIndex={muscleIndex} />
        </div>
      )}

      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Adaptation pool (⟳)</h2>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 12 }}>
        Routines the AI Coach reuses (overwriting in place) for schedule-adapted weeks — pushed
        one per available training day, oldest-tagged first, from the{" "}
        <a href="/coach" style={{ color: "#4f8ef7" }}>AI Coach</a> page. Toggle ⟳ on any routine
        below or in &quot;Other routines&quot; to add or remove it from this pool.
      </p>
      {adaptedPlan.length === 0 ? (
        <p style={{ color: "#888", fontSize: 13, marginBottom: 24 }}>
          Empty — the coach will auto-create routines here the first time you push an adapted week
          plan, or tag existing ones yourself with ⟳ now.
        </p>
      ) : (
        <>
          <PlanVolumeSummary
            volume={adaptedPlanVolume}
            targets={targets}
            title="Adaptation pool volume"
            description="Working sets per muscle across the routines currently tagged into the adaptation pool."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 16,
              marginBottom: 32,
            }}
          >
            {adaptedPlan.map((r) => (
              <RoutineCard key={r.id} routine={r} />
            ))}
          </div>
        </>
      )}

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Other routines</h2>
      <OtherRoutines />
    </main>
  );
}
