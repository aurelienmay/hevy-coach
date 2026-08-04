"use client";

import { useState } from "react";
import RoutineCard, { type Routine } from "@/components/RoutineCard";

export default function OtherRoutines({ routines }: { routines: Routine[] }) {
  const [shown, setShown] = useState(false);

  if (!shown) {
    return (
      <button
        onClick={() => setShown(true)}
        style={{
          background: "none",
          border: "1px solid #333",
          borderRadius: 8,
          padding: "8px 14px",
          color: "#ccc",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Show all routines ({routines.length}) to add a favorite
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {routines.map((r) => (
        <RoutineCard key={r.id} routine={r} compact />
      ))}
    </div>
  );
}
