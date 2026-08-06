"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";

/**
 * Five tabs, the iPhone maximum. Everything secondary lives behind the header
 * grid so the bar never grows a "More" catch-all.
 */
const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/plan", label: "Plan", icon: "calendar" },
  { href: "/fuel", label: "Fuel", icon: "fuel" },
  { href: "/core", label: "Body", icon: "body" },
  { href: "/coach", label: "Coach", icon: "coach" },
];

export function Nav({ pending = 0 }: { pending?: number }) {
  const pathname = usePathname();

  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((tab) => {
        const active =
          tab.href === "/"
            ? pathname === "/" ||
              pathname.startsWith("/day/") ||
              pathname.startsWith("/water") ||
              pathname.startsWith("/sleep") ||
              pathname.startsWith("/rest-hr") ||
              pathname.startsWith("/hrv")
            : pathname.startsWith(tab.href);
        const badge = tab.href === "/coach" && pending > 0;

        return (
          <Link
            key={tab.href}
            className="tab"
            href={tab.href}
            aria-label={badge ? `${tab.label}, ${pending} waiting` : tab.label}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={tab.icon} size={23} strokeWidth={active ? 2 : 1.7} />
            <span className="tab__label">{tab.label}</span>
            {badge ? <span className="tab__dot" aria-hidden="true" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
