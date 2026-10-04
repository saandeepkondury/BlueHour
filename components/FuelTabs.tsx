"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/fuel", label: "Log" },
  { href: "/fuel/recipes", label: "Recipes" },
];

export function FuelTabs() {
  const pathname = usePathname();

  return (
    <div className="seg" role="tablist" aria-label="Fuel sections">
      {TABS.map((tab) => {
        const active =
          tab.href === "/fuel" ? pathname === "/fuel" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            prefetch
            aria-selected={active}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
