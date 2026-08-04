"use client";

import { useEffect } from "react";

// Catches anything the per-page try/catches don't (Supabase hiccups, coding
// bugs, etc.) so a broken page shows a recoverable message instead of the
// framework's default error screen. Doesn't cover app/layout.tsx itself --
// that would need app/global-error.tsx.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={() => reset()}
        style={{
          background: "#4f8ef7",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "10px 18px",
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </main>
  );
}
