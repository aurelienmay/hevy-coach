"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { VolumeTargets } from "@/lib/currentUser";
import { ALL_MUSCLES, defaultVolumeTargetsFor } from "@/lib/volumeTargets";
import {
  GOALS,
  EXPERIENCE_LEVELS,
  GOAL_LABELS,
  EXPERIENCE_LABELS,
  MUSCLE_PRIORITIES,
  MUSCLE_PRIORITY_LABELS,
  type TrainingProfile,
  type MusclePriority,
  type MusclePriorities,
} from "@/lib/trainingProfile";
import {
  WEEKDAY_ORDER,
  WEEKDAY_LABELS,
  type NormalTrainingWeek,
  type ScheduleException,
} from "@/lib/schedule";
import {
  COACH_MODELS,
  COACH_MODEL_LABELS,
  COACH_MODEL_DESCRIPTIONS,
  COACH_MODEL_COST_HINTS,
  type CoachModelTier,
} from "@/lib/coachModel";

const MUSCLES = [...ALL_MUSCLES].sort();

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid #333",
  background: "#14171b",
  color: "#e6e6e6",
  fontSize: 14,
};

const TABS = [
  { key: "keys", label: "API Keys" },
  { key: "profile", label: "Training Profile" },
  { key: "schedule", label: "Schedule" },
  { key: "volume", label: "Volume Targets" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function SettingsForm({
  initialApiKey,
  initialAnthropicApiKey,
  initialOverrides,
  initialProfile,
  initialPriorities,
  initialNormalTrainingWeek,
  initialScheduleExceptions,
  initialCoachModel,
  needsKey,
  needsAnthropicKey,
}: {
  initialApiKey: string;
  initialAnthropicApiKey: string;
  initialOverrides: VolumeTargets;
  initialProfile: TrainingProfile;
  initialPriorities: MusclePriorities;
  initialNormalTrainingWeek: NormalTrainingWeek;
  initialScheduleExceptions: ScheduleException[];
  initialCoachModel: CoachModelTier;
  needsKey?: boolean;
  needsAnthropicKey?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(needsKey || needsAnthropicKey ? "keys" : "profile");
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [anthropicApiKey, setAnthropicApiKey] = useState(initialAnthropicApiKey);
  // Only muscles the user has explicitly chosen to pin by hand — everything
  // else stays dynamically computed from goal/experience/priority below, and
  // is never frozen into this map just by hitting Save.
  const [overrides, setOverrides] = useState<VolumeTargets>(initialOverrides);
  const [profile, setProfile] = useState<TrainingProfile>(initialProfile);
  const [priorities, setPriorities] = useState<MusclePriorities>(initialPriorities);
  const [normalTrainingWeek, setNormalTrainingWeek] = useState<NormalTrainingWeek>(initialNormalTrainingWeek);
  const [scheduleExceptions, setScheduleExceptions] = useState<ScheduleException[]>(initialScheduleExceptions);
  const [coachModel, setCoachModel] = useState<CoachModelTier>(initialCoachModel);
  const [newExceptionStart, setNewExceptionStart] = useState("");
  const [newExceptionEnd, setNewExceptionEnd] = useState("");
  const [newExceptionNote, setNewExceptionNote] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The coach's science-based baseline — recomputed live as goal/experience/
  // priority change, so e.g. switching a muscle to "Maintain" shows the
  // lowered range immediately instead of only after a save+reload.
  const computedTargets = useMemo(
    () => defaultVolumeTargetsFor(profile.goal, profile.experienceLevel, priorities),
    [profile.goal, profile.experienceLevel, priorities]
  );

  function updateProfile<K extends keyof TrainingProfile>(field: K, value: TrainingProfile[K]) {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function updateOverride(muscle: string, field: "min" | "max", value: number) {
    setOverrides((prev) => ({
      ...prev,
      [muscle]: { ...(prev[muscle] ?? computedTargets[muscle]), [field]: value },
    }));
    setSaved(false);
  }

  function startOverride(muscle: string) {
    const current = computedTargets[muscle];
    if (!current) return;
    setOverrides((prev) => ({ ...prev, [muscle]: current }));
    setSaved(false);
  }

  function resetOverride(muscle: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[muscle];
      return next;
    });
    setSaved(false);
  }

  function updatePriority(muscle: string, value: MusclePriority) {
    setPriorities((prev) => ({ ...prev, [muscle]: value }));
    setSaved(false);
  }

  function toggleWeekday(weekday: number) {
    setNormalTrainingWeek((prev) =>
      prev.includes(weekday) ? prev.filter((d) => d !== weekday) : [...prev, weekday]
    );
    setSaved(false);
  }

  function addException() {
    if (!newExceptionStart || !newExceptionEnd || newExceptionEnd < newExceptionStart) return;
    setScheduleExceptions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), startDate: newExceptionStart, endDate: newExceptionEnd, note: newExceptionNote.trim() },
    ]);
    setNewExceptionStart("");
    setNewExceptionEnd("");
    setNewExceptionNote("");
    setSaved(false);
  }

  function removeException(id: string) {
    setScheduleExceptions((prev) => prev.filter((e) => e.id !== id));
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
        volume_targets: overrides,
        training_profile: profile,
        muscle_priorities: priorities,
        normal_training_week: normalTrainingWeek,
        schedule_exceptions: scheduleExceptions,
        coach_model: coachModel,
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
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: active ? "1px solid #4f8ef7" : "1px solid #333",
                background: active ? "#1c3157" : "#14171b",
                color: active ? "#cddcf7" : "#888",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ display: tab === "keys" ? "block" : "none" }}>
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

      <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 6 }}>
        AI Coach model
      </label>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 12 }}>
        Which Claude model powers your weekly review, routine review, and week-plan adaptation —
        billed against the Anthropic key above. Sonnet is the recommended default: a stronger
        balance of reasoning quality, speed, and cost than Haiku. Switch to Haiku for
        faster/cheaper generations if you don&apos;t mind occasionally weaker adherence to the
        coach&apos;s own rules, or to Opus for the most capable reasoning at extra latency and
        cost. Even Opus runs well under a cent per generation at this app&apos;s typical prompt
        sizes.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {COACH_MODELS.map((tier) => {
          const active = coachModel === tier;
          return (
            <label
              key={tier}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: "10px 12px",
                borderRadius: 6,
                border: active ? "1px solid #4f8ef7" : "1px solid #333",
                background: active ? "#1c3157" : "#14171b",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="radio"
                  name="coach_model"
                  value={tier}
                  checked={active}
                  onChange={() => {
                    setCoachModel(tier);
                    setSaved(false);
                  }}
                />
                <span style={{ fontSize: 14, color: "#e6e6e6" }}>{COACH_MODEL_LABELS[tier]}</span>
                <span style={{ fontSize: 11, color: "#666" }}>{COACH_MODEL_COST_HINTS[tier]}</span>
              </span>
              <span style={{ fontSize: 12, color: "#888", marginLeft: 24 }}>
                {COACH_MODEL_DESCRIPTIONS[tier]}
              </span>
            </label>
          );
        })}
      </div>
      </div>

      <div style={{ display: tab === "profile" ? "block" : "none" }}>
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>Training profile</h2>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 12 }}>
        Tells the AI Coach what you're actually training for, so its advice and
        default volume targets are tailored to you instead of one-size-fits-all.
      </p>

      <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 6 }}>Goal</label>
      <select
        value={profile.goal}
        onChange={(e) => updateProfile("goal", e.target.value as TrainingProfile["goal"])}
        style={{ ...inputStyle, marginBottom: 16 }}
      >
        {GOALS.map((g) => (
          <option key={g} value={g}>
            {GOAL_LABELS[g]}
          </option>
        ))}
      </select>

      <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 6 }}>Experience level</label>
      <select
        value={profile.experienceLevel}
        onChange={(e) => updateProfile("experienceLevel", e.target.value as TrainingProfile["experienceLevel"])}
        style={{ ...inputStyle, marginBottom: 16 }}
      >
        {EXPERIENCE_LEVELS.map((lvl) => (
          <option key={lvl} value={lvl}>
            {EXPERIENCE_LABELS[lvl]}
          </option>
        ))}
      </select>

      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 6 }}>Training days/week</label>
          <input
            type="number"
            min={1}
            max={7}
            value={profile.daysPerWeek}
            onChange={(e) => updateProfile("daysPerWeek", Number(e.target.value))}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 6 }}>Session length (min)</label>
          <input
            type="number"
            min={15}
            step={5}
            value={profile.sessionMinutes}
            onChange={(e) => updateProfile("sessionMinutes", Number(e.target.value))}
            style={inputStyle}
          />
        </div>
      </div>

      <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 6 }}>
        Notes <span style={{ color: "#666" }}>(optional)</span>
      </label>
      <textarea
        placeholder="Injuries, equipment limits, exercise preferences, anything the coach should factor in…"
        value={profile.notes}
        onChange={(e) => updateProfile("notes", e.target.value)}
        rows={3}
        style={{ ...inputStyle, marginBottom: 24, resize: "vertical", fontFamily: "inherit" }}
      />
      </div>

      <div style={{ display: tab === "schedule" ? "block" : "none" }}>
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>Weekly schedule</h2>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 12 }}>
        Your normal training week, plus any upcoming date ranges you won&apos;t be able to train
        (holidays, travel). The AI Coach uses this to adapt a specific week&apos;s plan around the
        days you actually have available.
      </p>

      <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 6 }}>
        Normal training days
      </label>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {WEEKDAY_ORDER.map((weekday) => {
          const active = normalTrainingWeek.includes(weekday);
          return (
            <button
              key={weekday}
              type="button"
              onClick={() => toggleWeekday(weekday)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: active ? "1px solid #4f8ef7" : "1px solid #333",
                background: active ? "#1c3157" : "#14171b",
                color: active ? "#cddcf7" : "#888",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {WEEKDAY_LABELS[weekday].slice(0, 3)}
            </button>
          );
        })}
      </div>

      <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 6 }}>
        Upcoming exceptions <span style={{ color: "#666" }}>(holidays, travel, etc.)</span>
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {scheduleExceptions.length === 0 && (
          <p style={{ color: "#666", fontSize: 12, margin: 0 }}>None set.</p>
        )}
        {scheduleExceptions.map((exception) => (
          <div
            key={exception.id}
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}
          >
            <span style={{ color: "#ccc" }}>
              {exception.startDate} → {exception.endDate}
            </span>
            {exception.note && <span style={{ color: "#888" }}>({exception.note})</span>}
            <button
              type="button"
              onClick={() => removeException(exception.id)}
              style={{
                background: "none",
                border: "1px solid #333",
                borderRadius: 6,
                padding: "2px 8px",
                color: "#888",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
        <input
          type="date"
          value={newExceptionStart}
          onChange={(e) => setNewExceptionStart(e.target.value)}
          style={{ ...inputStyle, width: 150 }}
        />
        <span style={{ color: "#666" }}>to</span>
        <input
          type="date"
          value={newExceptionEnd}
          onChange={(e) => setNewExceptionEnd(e.target.value)}
          style={{ ...inputStyle, width: 150 }}
        />
        <input
          type="text"
          placeholder="Note (e.g. Holiday)"
          value={newExceptionNote}
          onChange={(e) => setNewExceptionNote(e.target.value)}
          style={{ ...inputStyle, width: 160 }}
        />
        <button
          type="button"
          onClick={addException}
          disabled={!newExceptionStart || !newExceptionEnd}
          style={{
            background: "#2a2d33",
            border: "1px solid #3a3d44",
            borderRadius: 6,
            padding: "8px 12px",
            color: "#e2e2e2",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Add
        </button>
      </div>
      </div>

      <div style={{ display: tab === "volume" ? "block" : "none" }}>
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>Weekly volume targets</h2>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 12 }}>
        Working sets per muscle group, per week. Ranges are computed from published
        training-volume landmark research (MV/MEV/MAV/MRV, Israetel et al.) for your goal and
        experience — the same framework the AI Coach itself reasons with, so "Focus" pushes
        toward a muscle's productive ceiling (MRV) and never beyond it, and "Maintain" drops to
        just enough volume to hold what you have. One muscle's range never changes because of
        another muscle's priority — they're computed independently. The AI Coach can also set a
        muscle's target directly when you accept one of its suggestions. Override a muscle by
        hand only if you disagree, and Ignore drops it from tracking entirely (no target, no
        coach commentary) if you're not specifically training for it.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {MUSCLES.map((muscle) => {
          const priority = priorities[muscle] ?? "normal";
          const ignored = priority === "ignore";
          const isOverridden = !ignored && !!overrides[muscle];
          const computed = computedTargets[muscle];
          return (
            <div key={muscle} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, flexWrap: "wrap" }}>
              <span style={{ width: 80, flexShrink: 0, color: ignored ? "#666" : undefined }}>{muscle}</span>
              <select
                value={priority}
                onChange={(e) => updatePriority(muscle, e.target.value as MusclePriority)}
                style={{ ...inputStyle, width: 100, padding: "6px 8px" }}
              >
                {MUSCLE_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {MUSCLE_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>

              {ignored || !computed ? (
                <span style={{ color: "#666", fontSize: 12 }}>not tracked</span>
              ) : isOverridden ? (
                <>
                  <input
                    type="number"
                    min={0}
                    value={overrides[muscle].min}
                    onChange={(e) => updateOverride(muscle, "min", Number(e.target.value))}
                    style={{ ...inputStyle, width: 60, padding: "6px 8px" }}
                  />
                  <span style={{ color: "#666" }}>to</span>
                  <input
                    type="number"
                    min={0}
                    value={overrides[muscle].max}
                    onChange={(e) => updateOverride(muscle, "max", Number(e.target.value))}
                    style={{ ...inputStyle, width: 60, padding: "6px 8px" }}
                  />
                  <button
                    type="button"
                    onClick={() => resetOverride(muscle)}
                    style={{
                      background: "none",
                      border: "1px solid #333",
                      borderRadius: 6,
                      padding: "4px 8px",
                      color: "#888",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Reset to coach recommendation
                  </button>
                </>
              ) : (
                <>
                  <span style={{ color: "#ccc" }}>
                    {computed.min}-{computed.max} sets
                  </span>
                  <span style={{ color: "#666", fontSize: 11 }}>coach-recommended</span>
                  <button
                    type="button"
                    onClick={() => startOverride(muscle)}
                    style={{
                      background: "none",
                      border: "1px solid #333",
                      borderRadius: 6,
                      padding: "4px 8px",
                      color: "#888",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Override
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
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
