import type { MuscleVolume } from "@/lib/planVolume";
import type { VolumeTargets } from "@/lib/currentUser";

// Categorical slots 1-3 (blue/orange/aqua) from the app's validated dark
// palette -- the set that clears the CVD/contrast checks under `--pairs all`,
// which matters here since all three bars in a row sit adjacent to each
// other. Chosen in this order to echo the existing ★/⚖/⟳ icon colors on
// RoutineCard (gold~orange, green~aqua, blue~blue) without changing them.
const SERIES = [
  { key: "current", label: "Current plan (★)", color: "#d95926" },
  { key: "compare", label: "Compare plan (⚖)", color: "#199e70" },
  { key: "adaptation", label: "Adaptation pool (⟳)", color: "#3987e5" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

export default function PlanComparisonChart({
  currentVolume,
  compareVolume,
  adaptationVolume,
  targets,
}: {
  currentVolume: MuscleVolume[];
  compareVolume: MuscleVolume[];
  adaptationVolume: MuscleVolume[];
  targets: VolumeTargets;
}) {
  const byMuscle: Record<SeriesKey, Map<string, number>> = {
    current: new Map(currentVolume.map((v) => [v.muscle, v.sets])),
    compare: new Map(compareVolume.map((v) => [v.muscle, v.sets])),
    adaptation: new Map(adaptationVolume.map((v) => [v.muscle, v.sets])),
  };

  const muscles = Array.from(
    new Set([
      ...Object.keys(targets),
      ...byMuscle.current.keys(),
      ...byMuscle.compare.keys(),
      ...byMuscle.adaptation.keys(),
    ])
  );

  if (muscles.length === 0) return null;

  const maxValue = Math.max(
    1,
    ...muscles.flatMap((m) => [
      byMuscle.current.get(m) ?? 0,
      byMuscle.compare.get(m) ?? 0,
      byMuscle.adaptation.get(m) ?? 0,
      targets[m]?.max ?? 0,
    ])
  );

  const rows = muscles
    .map((muscle) => ({
      muscle,
      target: targets[muscle],
      values: SERIES.map((s) => ({ ...s, sets: byMuscle[s.key].get(muscle) ?? 0 })),
    }))
    .sort((a, b) => Math.max(...b.values.map((v) => v.sets)) - Math.max(...a.values.map((v) => v.sets)));

  return (
    <div style={{ background: "#14171b", border: "1px solid #23262b", borderRadius: 10, padding: 16, marginBottom: 32 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Plan volume comparison</h2>
      <p style={{ color: "#898781", fontSize: 12, marginBottom: 12 }}>
        Working sets per muscle: current plan vs. compare plan vs. adaptation pool, against a
        typical weekly target (shaded band).
      </p>

      {/* Legend -- always present for 2+ series, the dependable identity channel. */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        {SERIES.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#c3c2b7" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            {s.label}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map(({ muscle, target, values }) => (
          <div key={muscle} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 90, flexShrink: 0, fontSize: 13, color: "#e6e6e6" }}>{muscle}</span>

            <div style={{ flex: 1, position: "relative" }}>
              {target && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${Math.min(100, (target.min / maxValue) * 100)}%`,
                    width: `${Math.min(100, ((target.max - target.min) / maxValue) * 100)}%`,
                    background: "rgba(195,194,183,0.08)",
                    borderLeft: "1px solid rgba(195,194,183,0.25)",
                    borderRight: "1px solid rgba(195,194,183,0.25)",
                    zIndex: 0,
                  }}
                />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 2, position: "relative", zIndex: 1 }}>
                {values.map((v) => (
                  <div
                    key={v.key}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                    title={`${muscle} — ${v.label}: ${v.sets} working sets${target ? ` (target ${target.min}-${target.max})` : ""}`}
                    tabIndex={0}
                  >
                    <div style={{ flex: 1, height: 8 }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, (v.sets / maxValue) * 100)}%`,
                          background: v.color,
                          borderRadius: "0 4px 4px 0",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        width: 22,
                        textAlign: "right",
                        fontSize: 11,
                        color: "#898781",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {v.sets}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <span style={{ width: 76, flexShrink: 0, fontSize: 11, color: "#666" }}>
              {target ? `target ${target.min}-${target.max}` : "no target"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
