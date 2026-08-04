// Shared helpers for deriving stats from live Hevy workout data (replaces
// what used to be SQL aggregations over the synced workouts/sets tables).
import type { HevyWorkout } from "@/lib/hevy";
import { muscleFor } from "@/lib/muscleMap";

// Monday 00:00, matching Postgres's date_trunc('week', ...) (ISO weeks start Monday).
export function startOfWeek(d: Date = new Date()): Date {
  const day = d.getDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // days since Monday
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function startOfMonth(d: Date = new Date(), monthsAgo = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() - monthsAgo, 1, 0, 0, 0, 0);
}

export function addWeeks(d: Date, weeks: number): Date {
  return new Date(d.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
}

export function workingSets(w: HevyWorkout) {
  return w.exercises.flatMap((ex) => ex.sets.filter((s) => s.type !== "warmup"));
}

export function totalSetsCount(w: HevyWorkout): number {
  return w.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
}

export function workingSetsCount(w: HevyWorkout): number {
  return workingSets(w).length;
}

export type MuscleVolume = { muscle: string; sets: number };

export function muscleVolume(workouts: HevyWorkout[], excludedMuscles: string[]): MuscleVolume[] {
  const counts: Record<string, number> = {};
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const muscle = muscleFor(ex.title);
      if (excludedMuscles.includes(muscle)) continue;
      const sets = ex.sets.filter((s) => s.type !== "warmup").length;
      if (sets === 0) continue;
      counts[muscle] = (counts[muscle] ?? 0) + sets;
    }
  }
  return Object.entries(counts)
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets);
}

export function workoutsInRange(workouts: HevyWorkout[], from: Date, to?: Date): HevyWorkout[] {
  return workouts.filter((w) => {
    const t = new Date(w.start_time);
    return t >= from && (!to || t < to);
  });
}
