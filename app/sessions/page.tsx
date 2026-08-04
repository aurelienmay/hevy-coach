import { fetchAllWorkouts } from "@/lib/hevy";
import { requireHevyApiKey } from "@/lib/currentUser";
import { startOfMonth, totalSetsCount, workingSetsCount } from "@/lib/workoutStats";
import SessionTitleEditor from "@/components/SessionTitleEditor";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const { apiKey } = await requireHevyApiKey();
  const workouts = await fetchAllWorkouts(apiKey, startOfMonth(new Date(), 1).toISOString());
  const sessions = [...workouts].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  );

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Sessions</h1>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#888", borderBottom: "1px solid #333" }}>
            <th style={{ padding: "6px 8px" }}>Date</th>
            <th style={{ padding: "6px 8px" }}>Title</th>
            <th style={{ padding: "6px 8px" }}>Duration</th>
            <th style={{ padding: "6px 8px" }}>Working sets</th>
            <th style={{ padding: "6px 8px" }}>Total sets</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const durMin = Math.round(
              (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000
            );
            return (
              <tr key={s.id} style={{ borderBottom: "1px solid #1c1f23" }}>
                <td style={{ padding: "6px 8px" }}>{new Date(s.start_time).toLocaleDateString()}</td>
                <td style={{ padding: "6px 8px" }}>
                  <SessionTitleEditor sessionId={s.id} title={s.title} />
                </td>
                <td style={{ padding: "6px 8px" }}>{durMin} min</td>
                <td style={{ padding: "6px 8px" }}>{workingSetsCount(s)}</td>
                <td style={{ padding: "6px 8px", color: "#888" }}>{totalSetsCount(s)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
