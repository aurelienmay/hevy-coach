import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Exchanges the confirmation-link/recovery-link code Supabase emails for a session.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const next = req.nextUrl.searchParams.get("next");
  const redirectPath = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return NextResponse.redirect(new URL(redirectPath, req.url));
}
