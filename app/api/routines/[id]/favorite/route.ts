import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { favorite } = await req.json();
  await sql`update routines set is_favorite = ${Boolean(favorite)} where id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
