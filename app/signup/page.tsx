import Link from "next/link";
import AuthForm from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Create an account</h1>
      <AuthForm mode="signup" />
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 16 }}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </main>
  );
}
