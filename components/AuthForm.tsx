"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function onForgotPassword() {
    if (!email) {
      setError("Enter your email above first.");
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResetSent(true);
  }

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
      <p style={{ color: "var(--text-primary)", fontSize: 14 }}>
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
        className="input"
        style={{ marginBottom: 12 }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        className="input"
        style={{ marginBottom: 12 }}
      />
      {error && <p style={{ color: "var(--error)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      {resetSent && (
        <p style={{ color: "var(--link)", fontSize: 13, marginBottom: 12 }}>
          Check your email ({email}) for a link to reset your password.
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary" style={{ width: "100%" }}>
        {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Sign up"}
      </button>
      {mode === "login" && (
        <button
          type="button"
          onClick={onForgotPassword}
          disabled={pending}
          className="btn btn-ghost"
          style={{ width: "100%", marginTop: 8 }}
        >
          Forgot password?
        </button>
      )}
    </form>
  );
}
