import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { BrandMark } from "@/components/Brand";
import { Icon, type IconName } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { daysBetween, formatShort, todayISO } from "@/lib/date";
import { pendingCount } from "@/lib/coach/store";
import { getProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

const GROUPS: { title: string; links: { href: string; label: string; icon: IconName }[] }[] = [
  {
    title: "Training",
    links: [
      { href: "/progress", label: "Progress", icon: "chart" },
      { href: "/core", label: "Body & core", icon: "body" },
    ],
  },
  {
    title: "Recovery",
    links: [
      { href: "/water", label: "Water", icon: "water" },
      { href: "/sleep", label: "Sleep", icon: "moon" },
      { href: "/rest-hr", label: "Resting HR", icon: "heart" },
      { href: "/hrv", label: "HRV", icon: "pulse" },
    ],
  },
  {
    title: "Fuel",
    links: [
      { href: "/fuel/grocery", label: "Grocery list", icon: "cart" },
      { href: "/fuel/supplements", label: "Supplements", icon: "pill" },
      { href: "/fuel/race", label: "Race-day playbook", icon: "flag" },
    ],
  },
  {
    title: "App",
    links: [
      { href: "/settings/watch", label: "Apple Health sync", icon: "watch" },
      { href: "/settings", label: "Settings", icon: "settings" },
    ],
  },
];

export default async function MorePage() {
  const [current, pending] = await Promise.all([getProfile(), pendingCount()]);
  const days = daysBetween(todayISO(), current.raceDate);

  return (
    <>
      <Shell>
        <AppBar
          title="More"
          back="/"
          action={
            <Link className="iconbtn" href="/settings" aria-label="Settings">
              <Icon name="settings" size={20} />
            </Link>
          }
        />

        <section className="block block--tight">
          <div className="card">
            <div className="row">
              <span style={{ flex: "0 0 auto", display: "grid", placeItems: "center" }}>
                <BrandMark size={34} />
              </span>
              <div className="row__body">
                <span className="row__title">{current.raceName}</span>
                <span className="row__sub">
                  {formatShort(current.raceDate)}
                  {days > 0 ? ` · ${days} days out` : ""}
                </span>
              </div>
              <Link className="btn btn--ghost btn--sm" href="/settings">
                Edit
              </Link>
            </div>
          </div>
        </section>

        {GROUPS.map((group) => (
          <section className="block" key={group.title}>
            <div className="block__head">
              <h2 className="block__title">{group.title}</h2>
            </div>
            <div className="card" style={{ paddingTop: 0, paddingBottom: 0 }}>
              <div className="rows">
                {group.links.map((link) => (
                  <Link className="row" href={link.href} key={link.href}>
                    <span className="row__lead">
                      <Icon name={link.icon} size={17} />
                    </span>
                    <span className="row__body">
                      <span className="row__title">{link.label}</span>
                    </span>
                    <Icon name="chevron" size={16} />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ))}
      </Shell>
      <Nav pending={pending} />
    </>
  );
}
