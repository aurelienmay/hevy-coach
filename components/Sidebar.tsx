"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/routines", label: "Routines" },
  { href: "/sessions", label: "Sessions" },
  { href: "/coach", label: "Coach" },
];

export default function Sidebar() {
  const pathname = usePathname();

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
              color: active ? "#fff" : "#9ecbff",
              background: active ? "#1a2230" : "transparent",
              textDecoration: "none",
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
