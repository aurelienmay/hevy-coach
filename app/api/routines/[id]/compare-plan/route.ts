import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Toggles whether a routine is tagged into the "compare plan" set, shown
// alongside the current plan (favorites) for a volume comparison. Same
// mechanic as the favorite toggle, just a separate tag.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { compare?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body.compare !== "boolean") {
    return NextResponse.json({ error: "compare must be a boolean" }, { status: 400 });
  }
  const { compare } = body;

  const { error } = compare
    ? await supabase.from("compare_plan_routines").upsert({ user_id: user.id, routine_id: id })
    : await supabase.from("compare_plan_routines").delete().eq("user_id", user.id).eq("routine_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
