import postgres from "postgres";

// Reuses a single connection across invocations in the same serverless instance.
declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

export const sql =
  global.__sql ??
  postgres(process.env.DATABASE_URL!, {
    ssl: "require",
    max: 5,
    // Supabase's pooled connection (port 6543) runs pgbouncer in transaction
    // mode, which doesn't support prepared statements.
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  global.__sql = sql;
}
