import VolumeChart from "@/components/VolumeChart";
import { fetchAllWorkouts } from "@/lib/hevy";
import { muscleVolume, startOfMonth, startOfWeek, totalSetsCount, workingSetsCount } from "@/lib/workoutStats";

export const dynamic = "force-dynamic";

const EXCLUDED = ["cardio", "other"];

export default async function OverviewPage() {
  const workouts = await fetchAllWorkouts(startOfMonth(new Date(), 1).toISOString());
  const sorted = [...workouts].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  );

  const thisWeek = workouts.filter((w) => new Date(w.start_time) >= startOfWeek());
  const volume = muscleVolume(thisWeek, EXCLUDED);
  const sessions = sorted.slice(0, 5);
  const lastLogged = sorted[0]?.start_time ?? null;

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>This week — working sets only</h1>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
        Warm-up sets are excluded. Most recent logged workout: {lastLogged ? new Date(lastLogged).toLocaleString() : "no data yet"}.
      </p>

      {volume.length === 0 ? (
        <p style={{ color: "#888" }}>No working sets logged yet this week.</p>
      ) : (
        <VolumeChart data={volume} />
      )}

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>Recent sessions</h2>
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
    </main>
  );
}
