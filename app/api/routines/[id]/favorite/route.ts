import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { favorite?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body.favorite !== "boolean") {
    return NextResponse.json({ error: "favorite must be a boolean" }, { status: 400 });
  }
  const { favorite } = body;

  const { error } = favorite
    ? await supabase.from("favorite_routines").upsert({ user_id: user.id, routine_id: id })
    : await supabase.from("favorite_routines").delete().eq("user_id", user.id).eq("routine_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
