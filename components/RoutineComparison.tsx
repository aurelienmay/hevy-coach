import RoutineCard, { type Routine } from "@/components/RoutineCard";
import PlanVolumeSummary from "@/components/PlanVolumeSummary";
import { computePlanVolume } from "@/lib/planVolume";
import type { MuscleIndex } from "@/lib/exerciseTemplates";
import type { VolumeTargets } from "@/lib/currentUser";

// Purely presentational: the compare set is a persisted tag (⚖ on
// RoutineCard, see app/api/routines/[id]/compare-plan/route.ts), not local
// state, so this just renders whatever the caller already fetched -- no
// fetch/add/remove logic of its own anymore.
export default function RoutineComparison({
  favorites,
  comparePlan,
  targets,
  muscleIndex,
}: {
  favorites: Routine[];
  comparePlan: Routine[];
  targets: VolumeTargets;
  muscleIndex: MuscleIndex;
}) {
  if (favorites.length === 0) return null;

  const comparisonVolume = computePlanVolume(comparePlan, muscleIndex);
  const combinedVolume = computePlanVolume([...favorites, ...comparePlan], muscleIndex);

  return (
    <>
      <div>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Compare plan (⚖)</h2>

        {comparePlan.length === 0 ? (
          <p style={{ color: "#888", fontSize: 13, marginBottom: 24 }}>
            No routines tagged for comparison yet.
          </p>
        ) : (
          <>
            <PlanVolumeSummary
              volume={comparisonVolume}
              targets={targets}
              title="Compare plan volume"
              description="Working sets per muscle across the routines tagged for comparison, vs. a typical weekly target."
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 16,
              }}
            >
              {comparePlan.map((r) => (
                <RoutineCard key={r.id} routine={r} />
              ))}
            </div>
          </>
        )}
      </div>

      {comparePlan.length > 0 && (
        <div style={{ gridColumn: "1 / -1" }}>
          <PlanVolumeSummary
            volume={combinedVolume}
            targets={targets}
            title="Combined weekly volume"
            description="Current plan + compare plan combined — use this to see how well both together hit your weekly set goals."
          />
        </div>
      )}
    </>
  );
}
