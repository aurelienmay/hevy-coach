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
function NavLinkLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return <span style={{ opacity: pending ? 0.5 : 1, transition: "opacity var(--transition-fast)" }}>{label}</span>;
}

function SignOutButton({ style }: { style?: React.CSSProperties }) {
  return (
    <form action="/api/auth/signout" method="POST">
      <button type="submit" className="btn btn-sm btn-ghost" style={style}>
        Sign out
      </button>
    </form>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
      {/* Mobile only: app title + sign out, sticky above the page content. */}
      <div className="mobile-topbar">
        <span style={{ fontWeight: 600, fontSize: 15 }}>Hevy Coach</span>
        <SignOutButton />
      </div>

      {/* Desktop only: left-hand nav column. */}
      <nav className="sidebar-desktop">
        {LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} className="nav-link" data-active={active}>
              <NavLinkLabel label={link.label} />
            </Link>
          );
        })}
        <SignOutButton style={{ width: "100%", justifyContent: "flex-start", marginTop: 16 }} />
      </nav>

      {/* Mobile only: fixed bottom tab bar. */}
      <nav className="mobile-bottomnav">
        {LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} data-active={active}>
              <NavLinkLabel label={link.label} />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
