"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setPending(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Set a new password</h1>
      <form onSubmit={onSubmit} style={{ maxWidth: 320 }}>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="input"
          style={{ marginBottom: 12 }}
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={6}
          className="input"
          style={{ marginBottom: 12 }}
        />
        {error && <p style={{ color: "var(--error)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={pending} className="btn btn-primary" style={{ width: "100%" }}>
          {pending ? "Please wait…" : "Update password"}
        </button>
      </form>
    </main>
  );
}
