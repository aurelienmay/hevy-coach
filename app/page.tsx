import Link from "next/link";
import VolumeChart from "@/components/VolumeChart";
import HevyError from "@/components/HevyError";
import PlanVolumeSummary from "@/components/PlanVolumeSummary";
import { fetchAllWorkouts, type HevyWorkout } from "@/lib/hevy";
import { requireHevyApiKey, getVolumeTargets } from "@/lib/currentUser";
import { buildMuscleIndex, getExerciseTemplates, type MuscleIndex } from "@/lib/exerciseTemplates";
import {
  addWeeks,
  muscleVolume,
  startOfWeek,
  totalSetsCount,
  unmappedExerciseTitles,
  workingSetsCount,
  workoutsInRange,
} from "@/lib/workoutStats";

export const dynamic = "force-dynamic";

const EXCLUDED = ["cardio", "other"];

function formatRange(from: Date, to: Date) {
  const end = new Date(to.getTime() - 1);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${from.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const { userId, apiKey } = await requireHevyApiKey();
  const weekOffset = Math.min(0, Number(week ?? 0) || 0);
  const weekStart = addWeeks(startOfWeek(), weekOffset);
  const weekEnd = addWeeks(weekStart, 1);

  let workouts: HevyWorkout[];
  let targets;
  let muscleIndex: MuscleIndex;
  try {
    let templates;
    [workouts, templates, targets] = await Promise.all([
      fetchAllWorkouts(apiKey, weekStart.toISOString()),
      getExerciseTemplates(apiKey),
      getVolumeTargets(userId),
    ]);
    muscleIndex = buildMuscleIndex(templates);
  } catch (err) {
    return (
      <main>
        <h1 style={{ fontSize: 22, marginBottom: 20 }}>
          {weekOffset === 0 ? "This week" : formatRange(weekStart, weekEnd)} — working sets only
        </h1>
        <HevyError error={err} />
      </main>
    );
  }
  const thisWeek = workoutsInRange(workouts, weekStart, weekEnd);
  const sessions = [...thisWeek].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  );
  const volume = muscleVolume(thisWeek, EXCLUDED, muscleIndex);
  const unmapped = unmappedExerciseTitles(thisWeek, muscleIndex);

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h1 style={{ fontSize: 22 }}>
          {weekOffset === 0 ? "This week" : formatRange(weekStart, weekEnd)} — working sets only
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href={`/?week=${weekOffset - 1}`}
            style={{ border: "1px solid #333", borderRadius: 6, padding: "4px 10px", fontSize: 13, color: "#ccc", textDecoration: "none" }}
          >
            ← Prev week
          </Link>
          {weekOffset < 0 && (
            <Link
              href={`/?week=${weekOffset + 1}`}
              style={{ border: "1px solid #333", borderRadius: 6, padding: "4px 10px", fontSize: 13, color: "#ccc", textDecoration: "none" }}
            >
              Next week →
            </Link>
          )}
        </div>
      </div>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
        {formatRange(weekStart, weekEnd)} · warm-up sets excluded.
      </p>

      {unmapped.length > 0 && (
        <p style={{ color: "#e0a030", fontSize: 13, marginBottom: 16 }}>
          Not counted toward any muscle (unmapped exercise): {unmapped.join(", ")}
        </p>
      )}

      <PlanVolumeSummary
        volume={volume}
        targets={targets}
        title="Sets done vs. weekly target"
        description="Working sets logged so far this week per muscle, vs. your weekly target."
      />

      {volume.length === 0 ? (
        <p style={{ color: "#888" }}>No working sets logged this week.</p>
      ) : (
        <VolumeChart data={volume} />
      )}

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>Sessions this week</h2>
      {sessions.length === 0 ? (
        <p style={{ color: "#888", fontSize: 13 }}>No sessions logged this week.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#888", borderBottom: "1px solid #333" }}>
              <th style={{ padding: "6px 8px" }}>Date</th>
              <th style={{ padding: "6px 8px" }}>Title</th>
              <th style={{ padding: "6px 8px" }}>Working sets</th>
              <th style={{ padding: "6px 8px" }}>Total sets (incl. warmup)</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #1c1f23" }}>
                <td style={{ padding: "6px 8px" }}>{new Date(s.start_time).toLocaleDateString()}</td>
                <td style={{ padding: "6px 8px" }}>{s.title}</td>
                <td style={{ padding: "6px 8px" }}>{workingSetsCount(s)}</td>
                <td style={{ padding: "6px 8px" }}>{totalSetsCount(s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
