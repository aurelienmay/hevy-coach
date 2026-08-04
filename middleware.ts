import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  // Never gate the cron endpoint behind basic auth - it authenticates via CRON_SECRET instead.
  if (req.nextUrl.pathname.startsWith("/api/sync")) {
    return NextResponse.next();
  }

  const auth = req.headers.get("authorization");
  const expected = "Basic " + Buffer.from(`coach:${process.env.DASHBOARD_PASSWORD}`).toString("base64");

  if (auth !== expected) {
    return new NextResponse("Auth required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Hevy Coach Dashboard"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
