"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VolumeTargets } from "@/lib/currentUser";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid #333",
  background: "#14171b",
  color: "#e6e6e6",
  fontSize: 14,
};

export default function SettingsForm({
  initialApiKey,
  initialAnthropicApiKey,
  initialTargets,
}: {
  initialApiKey: string;
  initialAnthropicApiKey: string;
  initialTargets: VolumeTargets;
}) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [anthropicApiKey, setAnthropicApiKey] = useState(initialAnthropicApiKey);
  const [targets, setTargets] = useState<VolumeTargets>(initialTargets);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const muscles = Object.keys(targets).sort();

  function updateTarget(muscle: string, field: "min" | "max", value: number) {
    setTargets((prev) => ({ ...prev, [muscle]: { ...prev[muscle], [field]: value } }));
    setSaved(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hevy_api_key: apiKey,
        anthropic_api_key: anthropicApiKey,
        volume_targets: targets,
      }),
    });

    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to save settings.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 480 }}>
      <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 6 }}>
        Hevy API key
      </label>
      <input
        type="password"
        placeholder="Paste your Hevy API key"
        value={apiKey}
        onChange={(e) => { setApiKey(e.target.value); setSaved(false); }}
        required
        style={{ ...inputStyle, marginBottom: 24 }}
      />
      <p style={{ color: "#666", fontSize: 12, marginTop: -18, marginBottom: 24 }}>
        Hevy app → Settings → Developer → generate an API key (requires Hevy Pro).
      </p>

      <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 6 }}>
        Anthropic API key <span style={{ color: "#666" }}>(optional)</span>
      </label>
      <input
        type="password"
        placeholder="Paste your Anthropic API key"
        value={anthropicApiKey}
        onChange={(e) => { setAnthropicApiKey(e.target.value); setSaved(false); }}
        style={{ ...inputStyle, marginBottom: 24 }}
      />
      <p style={{ color: "#666", fontSize: 12, marginTop: -18, marginBottom: 24 }}>
        console.anthropic.com → API Keys. Only needed for the AI Coach page, and it's your
        own key — usage is billed to your Anthropic account, not shared with other users.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 4 }}>Weekly volume targets</h2>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 12 }}>
        Working sets per muscle group, per week.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {muscles.map((muscle) => (
          <div key={muscle} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span style={{ width: 90, flexShrink: 0 }}>{muscle}</span>
            <input
              type="number"
              min={0}
              value={targets[muscle].min}
              onChange={(e) => updateTarget(muscle, "min", Number(e.target.value))}
              style={{ ...inputStyle, width: 70, padding: "6px 8px" }}
            />
            <span style={{ color: "#666" }}>to</span>
            <input
              type="number"
              min={0}
              value={targets[muscle].max}
              onChange={(e) => updateTarget(muscle, "max", Number(e.target.value))}
              style={{ ...inputStyle, width: 70, padding: "6px 8px" }}
            />
          </div>
        ))}
      </div>

      {error && <p style={{ color: "#f56565", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      {saved && <p style={{ color: "#68d391", fontSize: 13, marginBottom: 12 }}>Saved.</p>}

      <button
        type="submit"
        disabled={pending}
        style={{
          padding: "10px 18px",
          borderRadius: 6,
          border: "none",
          background: "#4f8ef7",
          color: "#fff",
          fontSize: 14,
          cursor: pending ? "default" : "pointer",
        }}
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
