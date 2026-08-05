"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/fuel", label: "This week" },
  { href: "/fuel/grocery", label: "Grocery" },
  { href: "/fuel/supplements", label: "Supplements" },
  { href: "/fuel/race", label: "Race day" },
];

export function FuelTabs() {
  const pathname = usePathname();

  return (
    <div className="tabs">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname === tab.href ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
