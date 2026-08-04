import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isVolumeTargets } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { hevy_api_key?: unknown; anthropic_api_key?: unknown; volume_targets?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { hevy_api_key, anthropic_api_key, volume_targets } = body;

  if (typeof hevy_api_key !== "string" || !hevy_api_key.trim()) {
    return NextResponse.json({ error: "hevy_api_key is required" }, { status: 400 });
  }
  if (anthropic_api_key !== undefined && typeof anthropic_api_key !== "string") {
    return NextResponse.json({ error: "anthropic_api_key must be a string" }, { status: 400 });
  }
  if (volume_targets != null && !isVolumeTargets(volume_targets)) {
    return NextResponse.json({ error: "volume_targets must be an object of {muscle: {min, max}}" }, { status: 400 });
  }

  const { error } = await supabase.from("user_settings").upsert({
    user_id: user.id,
    hevy_api_key,
    anthropic_api_key,
    volume_targets,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
