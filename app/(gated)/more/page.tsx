import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { formatLong } from "@/lib/date";
import { pendingCount } from "@/lib/coach/store";
import { getProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/progress", title: "Progress", note: "Mileage, consistency, longest run, how the fuelling is tracking." },
  { href: "/core", title: "Core & abs", note: "Body-fat math, the tape measure, and the core progression." },
  { href: "/fuel/grocery", title: "Grocery list", note: "This week's meals, aggregated by aisle." },
  { href: "/fuel/supplements", title: "Supplements", note: "Only the ones that earn their place." },
  { href: "/fuel/race", title: "Race-day playbook", note: "Breakfast, gels, corral timing on Congress." },
  { href: "/settings/watch", title: "Apple Health sync", note: "The Shortcut that brings the Watch in." },
  { href: "/settings", title: "Settings", note: "Race, body stats, goals, reminders, coach key." },
];

export default async function MorePage() {
  const [current, pending] = await Promise.all([getProfile(), pendingCount()]);

  return (
    <>
      <Shell>
        <section className="sec">
          <p className="sec-label">Everything else</p>
          <h1 className="sec-title">
            The rest of the <em>block</em>
          </h1>
          <p className="sec-intro">
            {current.raceName} · {formatLong(current.raceDate)}
          </p>

          {LINKS.map((link) => (
            <Link className="day" key={link.href} href={link.href}>
              <span className="day-name">
                {link.title}
                <span className="block-cue">{link.note}</span>
              </span>
            </Link>
          ))}
        </section>
      </Shell>
      <Nav pending={pending} />
    </>
  );
}
