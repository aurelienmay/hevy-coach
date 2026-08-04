import Link from "next/link";
import { HevyApiError } from "@/lib/hevy";

// Renders a specific, actionable message for the failure modes that are
// actually likely here (bad/revoked key, rate limiting) instead of letting
// every Hevy hiccup surface as one generic error.
export default function HevyError({ error }: { error: unknown }) {
  const status = error instanceof HevyApiError ? error.status : null;

  let message: string;
  let showSettingsLink = false;

  if (status === 401 || status === 403) {
    message = `Hevy rejected your API key (error ${status}). It may have been revoked or mistyped.`;
    showSettingsLink = true;
  } else if (status === 429) {
    message = "Hevy is rate-limiting these requests right now — wait a minute, then refresh.";
  } else {
    message = `Couldn't load your data from Hevy right now${status ? ` (error ${status})` : ""} — this is usually temporary, try refreshing in a moment.`;
  }

  return (
    <div
      style={{
        background: "#14171b",
        border: "1px solid #23262b",
        borderRadius: 10,
        padding: 16,
        color: "#ccc",
        fontSize: 14,
      }}
    >
      <p style={{ margin: 0 }}>{message}</p>
      {showSettingsLink && (
        <p style={{ margin: "10px 0 0" }}>
          <Link href="/settings" style={{ color: "#9ecbff" }}>
            Update it in Settings →
          </Link>
        </p>
      )}
    </div>
  );
}
