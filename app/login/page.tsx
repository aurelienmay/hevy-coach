import Link from "next/link";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Sign in</h1>
      <AuthForm mode="login" />
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 16 }}>
        No account? <Link href="/signup">Sign up</Link>
      </p>
    </main>
  );
}
