import { muscleFor } from "@/lib/muscleMap";
import { EXCLUDED_MUSCLES } from "@/lib/volumeTargets";
import type { Routine } from "@/components/RoutineCard";

export type MuscleVolume = { muscle: string; sets: number };

export function computePlanVolume(routines: Routine[]): MuscleVolume[] {
  const counts: Record<string, number> = {};

  for (const routine of routines) {
    for (const ex of routine.exercises ?? []) {
      const muscle = muscleFor(ex.title);
      if (EXCLUDED_MUSCLES.includes(muscle)) continue;
      const workingSets = ex.sets.filter((s) => s.type !== "warmup").length;
      counts[muscle] = (counts[muscle] ?? 0) + workingSets;
    }
  }

  return Object.entries(counts)
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets);
}
