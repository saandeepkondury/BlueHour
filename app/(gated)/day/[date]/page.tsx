import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { DayView } from "@/components/DayView";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { addDays, formatShort, startOfWeek, todayISO, weekdayShort } from "@/lib/date";
import { longRunOptions } from "@/lib/plan/adapt";
import { getDayBundle } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const bundle = await getDayBundle(date);
  if (!bundle) notFound();

  const today = todayISO();
  const options = await longRunOptions(startOfWeek(date));

  return (
    <>
      <Shell>
        <AppBar
          title={date === today ? "Today" : `${weekdayShort(date)}, ${formatShort(date)}`}
          subtitle={date === today ? formatShort(date) : `Week of ${formatShort(startOfWeek(date))}`}
          back="/plan"
          action={
            <span style={{ display: "flex" }}>
              <Link
                className="iconbtn"
                href={`/day/${addDays(date, -1)}`}
                aria-label="Previous day"
              >
                <Icon name="back" size={20} />
              </Link>
              <Link className="iconbtn" href={`/day/${addDays(date, 1)}`} aria-label="Next day">
                <Icon name="chevron" size={20} />
              </Link>
            </span>
          }
        />

        <DayView
          bundle={bundle}
          isToday={date === today}
          longRunOptions={options.map((option) => ({ date: option.date, title: option.title }))}
        />
      </Shell>
      <Nav />
    </>
  );
}
