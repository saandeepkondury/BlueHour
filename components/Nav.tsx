"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/plan", label: "Plan" },
  { href: "/fuel", label: "Fuel" },
  { href: "/core", label: "Core" },
  { href: "/coach", label: "Coach" },
  { href: "/more", label: "More" },
];

export function Nav({ pending = 0 }: { pending?: number }) {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        const badge = link.href === "/coach" && pending > 0;
        return (
          <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}>
            {badge ? `${link.label} ${pending}` : link.label}
          </Link>
        );
      })}
    </nav>
  );
}
