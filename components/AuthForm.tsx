"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid #333",
  background: "#14171b",
  color: "#e6e6e6",
  fontSize: 14,
  marginBottom: 12,
};

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setPending(false);
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/");
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setPending(false);
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        // Email confirmation is disabled -- signUp already returned a live session.
        router.push("/");
        router.refresh();
        return;
      }
      setConfirmSent(true);
    }
  }

  if (confirmSent) {
    return (
      <p style={{ color: "#ccc", fontSize: 14 }}>
        Check your email ({email}) for a confirmation link to finish creating your account.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 320 }}>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        style={inputStyle}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        style={inputStyle}
      />
      {error && <p style={{ color: "#f56565", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <button
        type="submit"
        disabled={pending}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 6,
          border: "none",
          background: "#4f8ef7",
          color: "#fff",
          fontSize: 14,
          cursor: pending ? "default" : "pointer",
        }}
      >
        {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Sign up"}
      </button>
    </form>
  );
}
