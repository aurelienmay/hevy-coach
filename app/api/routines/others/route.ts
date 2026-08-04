import { NextResponse } from "next/server";
import { fetchAllRoutines } from "@/lib/hevy";
import { requireHevyApiKey } from "@/lib/currentUser";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const { userId, apiKey } = await requireHevyApiKey();
  const supabase = createClient();

  const [routines, { data: favoriteRows }] = await Promise.all([
    fetchAllRoutines(apiKey),
    supabase.from("favorite_routines").select("routine_id").eq("user_id", userId),
  ]);

  const favoriteIds = new Set((favoriteRows ?? []).map((r) => r.routine_id));
  const others = routines
    .filter((r) => !favoriteIds.has(r.id))
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((r) => ({ ...r, is_favorite: false }));

  return NextResponse.json({ routines: others });
}
