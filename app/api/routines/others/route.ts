import { NextResponse } from "next/server";
import { fetchAllRoutines } from "@/lib/hevy";
import { requireHevyApiKey, getAdaptedPlanRoutineIds, getComparePlanRoutineIds } from "@/lib/currentUser";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const { userId, apiKey } = await requireHevyApiKey();
  const supabase = await createClient();

  const [routines, { data: favoriteRows }, adaptedIds, compareIds] = await Promise.all([
    fetchAllRoutines(apiKey),
    supabase.from("favorite_routines").select("routine_id").eq("user_id", userId),
    getAdaptedPlanRoutineIds(userId),
    getComparePlanRoutineIds(userId),
  ]);

  const favoriteIds = new Set((favoriteRows ?? []).map((r) => r.routine_id));
  const adaptedIdSet = new Set(adaptedIds);
  const compareIdSet = new Set(compareIds);
  // Excludes favorites and adaptation-pool routines, since those always have
  // a dedicated section above. Compare-plan-tagged routines stay listed here
  // too (with is_compare_plan set) since that section only renders once
  // there's a current plan to compare against -- excluding them here could
  // otherwise make a compare-only tag invisible everywhere.
  const others = routines
    .filter((r) => !favoriteIds.has(r.id) && !adaptedIdSet.has(r.id))
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((r) => ({ ...r, is_favorite: false, is_adapted_plan: false, is_compare_plan: compareIdSet.has(r.id) }));

  return NextResponse.json({ routines: others });
}
