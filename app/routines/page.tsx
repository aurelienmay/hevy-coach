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
import PlanComparisonChart from "@/components/PlanComparisonChart";
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

function RoutineColumn({ title, empty, routines }: { title: string; empty: string; routines: Routine[] }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>{title}</h2>
      {routines.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>{empty}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {routines.map((r) => (
            <RoutineCard key={r.id} routine={r} />
          ))}
        </div>
      )}
    </div>
  );
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
  const comparePlanVolume = computePlanVolume(comparePlan, muscleIndex);
  const adaptedPlanVolume = computePlanVolume(adaptedPlan, muscleIndex);

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Routines</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
        Star a routine (★) to mark it part of your current weekly plan. Toggle ⚖ to add it to the
        plan comparison, or ⟳ to add it to the AI Coach&apos;s reusable pool for schedule-adapted
        weeks — a routine can carry any combination of these tags.
      </p>

      <PlanComparisonChart
        currentVolume={planVolume}
        compareVolume={comparePlanVolume}
        adaptationVolume={adaptedPlanVolume}
        targets={targets}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 32,
          marginBottom: 32,
          alignItems: "start",
        }}
      >
        <RoutineColumn
          title="Current plan (★)"
          empty="No favorites yet — show other routines below and star one to add it to your plan."
          routines={favorites}
        />
        <RoutineColumn
          title="Compare plan (⚖)"
          empty="No routines tagged for comparison yet — toggle ⚖ on any routine to add it here."
          routines={comparePlan}
        />
        <RoutineColumn
          title="Adaptation pool (⟳)"
          empty="Empty — the AI Coach auto-creates routines here the first time you push an adapted week plan, or tag existing ones yourself with ⟳."
          routines={adaptedPlan}
        />
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Other routines</h2>
      <OtherRoutines />
    </main>
  );
}
