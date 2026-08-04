import { sql } from "@/lib/db";
import RoutineCard, { type Routine } from "@/components/RoutineCard";
import PlanVolumeSummary from "@/components/PlanVolumeSummary";
import { computePlanVolume } from "@/lib/planVolume";

export const dynamic = "force-dynamic";

async function getRoutines() {
  return sql<Routine[]>`
    select id, title, updated_at, is_favorite, raw
    from routines
    order by is_favorite desc, title asc
  `;
}

export default async function RoutinesPage() {
  const routines = await getRoutines();
  const favorites = routines.filter((r) => r.is_favorite);
  const others = routines.filter((r) => !r.is_favorite);
  const planVolume = computePlanVolume(favorites);

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Routines</h1>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
        Star a routine to mark it part of your current weekly plan.
      </p>

      {routines.length === 0 ? (
        <p style={{ color: "#888" }}>No routines synced yet.</p>
      ) : (
        <>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Current plan</h2>
          {favorites.length === 0 ? (
            <p style={{ color: "#888", fontSize: 13, marginBottom: 24 }}>
              No favorites yet — star a routine below to add it to your plan.
            </p>
          ) : (
            <>
              <PlanVolumeSummary volume={planVolume} />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: 16,
                  marginBottom: 32,
                }}
              >
                {favorites.map((r) => (
                  <RoutineCard key={r.id} routine={r} />
                ))}
              </div>
            </>
          )}

          {others.length > 0 && (
            <>
              <h2 style={{ fontSize: 18, marginBottom: 12 }}>Other routines</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {others.map((r) => (
                  <RoutineCard key={r.id} routine={r} compact />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
