"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SessionTitleEditor({
  sessionId,
  title,
}: {
  sessionId: string;
  title: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const next = value.trim();
    if (!next || next === title) {
      setValue(title);
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          autoFocus
          value={value}
          disabled={saving}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setValue(title);
              setEditing(false);
            }
          }}
          onBlur={save}
          className="input"
          style={{ color: "inherit", fontSize: 14, padding: "2px 6px" }}
        />
        {error && <span style={{ color: "var(--error)", fontSize: 12 }}>{error}</span>}
      </div>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Click to rename"
      style={{ cursor: "pointer" }}
    >
      {title}
    </span>
  );
}
