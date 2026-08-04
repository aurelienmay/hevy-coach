import type { MuscleVolume } from "@/lib/planVolume";

const STATUS_COLOR: Record<"low" | "ok" | "high", string> = {
  low: "#f56565",
  ok: "#68d391",
  high: "#f7b84f",
};

function statusFor(sets: number, target?: { min: number; max: number }): "low" | "ok" | "high" {
  if (!target) return "ok";
  if (sets < target.min) return "low";
  if (sets > target.max) return "high";
  return "ok";
}

export default function PlanVolumeSummary({
  volume,
  targets,
}: {
  volume: MuscleVolume[];
  targets: Record<string, { min: number; max: number }>;
}) {
  const byMuscle = new Map(volume.map((v) => [v.muscle, v.sets]));
  const muscles = Array.from(new Set([...Object.keys(targets), ...byMuscle.keys()]));

  const rows = muscles
    .map((muscle) => {
      const sets = byMuscle.get(muscle) ?? 0;
      const target = targets[muscle];
      return { muscle, sets, target, status: statusFor(sets, target) };
    })
    .sort((a, b) => b.sets - a.sets);

  return (
    <div style={{ background: "#14171b", border: "1px solid #23262b", borderRadius: 10, padding: 16, marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Weekly plan volume</h2>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 12 }}>
        Working sets per muscle across your favorited (starred) routines, vs. a typical weekly target.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map(({ muscle, sets, target, status }) => (
          <div key={muscle} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span style={{ width: 90, flexShrink: 0 }}>{muscle}</span>
            <div style={{ flex: 1, height: 8, background: "#1c1f23", borderRadius: 4, position: "relative", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, (sets / (target ? target.max : Math.max(sets, 1))) * 100)}%`,
                  background: STATUS_COLOR[status],
                  borderRadius: 4,
                }}
              />
            </div>
            <span style={{ width: 36, textAlign: "right", color: "#ccc" }}>{sets}</span>
            <span style={{ width: 70, color: "#666", fontSize: 11 }}>
              {target ? `target ${target.min}-${target.max}` : "no target"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
