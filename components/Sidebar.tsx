"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/routines", label: "Routines" },
  { href: "/sessions", label: "Sessions" },
  { href: "/coach", label: "Coach" },
  { href: "/settings", label: "Settings" },
];

const AUTH_PATHS = ["/login", "/signup", "/auth"];

// Renders inside the Link it belongs to, so useLinkStatus can flip this
// link's own style the instant it's clicked -- before the next page's data
// has even started loading. Without this, usePathname (and therefore the
// active-link highlight) only updates once navigation fully completes, so a
// click looked like nothing happened and people would click again.
function NavLinkLabel({ label, active }: { label: string; active: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span style={{ opacity: pending ? 0.5 : 1, color: active ? "#fff" : "#9ecbff" }}>{label}</span>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav style={{ width: 160, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2, paddingTop: 4 }}>
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              fontSize: 14,
              background: active ? "#1a2230" : "transparent",
              textDecoration: "none",
            }}
          >
            <NavLinkLabel label={link.label} active={active} />
          </Link>
        );
      })}
      <form action="/api/auth/signout" method="POST" style={{ marginTop: 16 }}>
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 14,
            color: "#888",
            background: "transparent",
            border: "1px solid #23262b",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
