import { fetchAllWorkouts, type HevyWorkout } from "@/lib/hevy";
import { requireHevyApiKey } from "@/lib/currentUser";
import { startOfMonth, totalSetsCount, workingSetsCount } from "@/lib/workoutStats";
import SessionTitleEditor from "@/components/SessionTitleEditor";
import HevyError from "@/components/HevyError";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const { apiKey } = await requireHevyApiKey();

  let workouts: HevyWorkout[];
  try {
    workouts = await fetchAllWorkouts(apiKey, startOfMonth(new Date(), 1).toISOString());
  } catch (err) {
    return (
      <main>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>Sessions</h1>
        <HevyError error={err} />
      </main>
    );
  }
  const sessions = [...workouts].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  );

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Sessions</h1>
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Title</th>
            <th>Duration</th>
            <th>Working sets</th>
            <th>Total sets</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const durMin = Math.round(
              (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000
            );
            return (
              <tr key={s.id}>
                <td>{new Date(s.start_time).toLocaleDateString()}</td>
                <td>
                  <SessionTitleEditor sessionId={s.id} title={s.title} />
                </td>
                <td>{durMin} min</td>
                <td>{workingSetsCount(s)}</td>
                <td style={{ color: "var(--text-secondary)" }}>{totalSetsCount(s)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
