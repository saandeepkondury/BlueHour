"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/fuel", label: "Week" },
  { href: "/fuel/grocery", label: "Grocery" },
  { href: "/fuel/supplements", label: "Supplements" },
  { href: "/fuel/race", label: "Race day" },
];

export function FuelTabs() {
  const pathname = usePathname();

  return (
    <div className="seg" role="tablist" aria-label="Fuel sections">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          role="tab"
          aria-selected={pathname === tab.href}
          aria-current={pathname === tab.href ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
