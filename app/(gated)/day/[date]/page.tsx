import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { DayView } from "@/components/DayView";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { addDays, formatShort, startOfWeek, todayISO, weekdayShort } from "@/lib/date";
import { pendingCount } from "@/lib/coach/store";
import { longRunOptions } from "@/lib/plan/adapt";
import { getDayBundle } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DayPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ from?: string; week?: string }>;
}) {
  const { date } = await params;
  const { from, week } = await searchParams;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const [bundle, pending] = await Promise.all([getDayBundle(date), pendingCount()]);
  if (!bundle) notFound();

  const today = todayISO();
  const isToday = date === today;
  const weekStart =
    week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? startOfWeek(week) : startOfWeek(date);
  const back =
    from === "fuel"
      ? `/fuel?w=${weekStart}&d=${date}`
      : isToday
        ? "/"
        : "/plan";
  const options = await longRunOptions(startOfWeek(date));

  return (
    <>
      <Shell>
        <AppBar
          title={isToday ? "Today" : `${weekdayShort(date)}, ${formatShort(date)}`}
          subtitle={
            isToday
              ? formatShort(date)
              : `Full day · sleep, run, meals, heart`
          }
          back={back}
          pending={pending}
          action={
            <span style={{ display: "flex" }}>
              <Link
                className="iconbtn"
                href={`/day/${addDays(date, -1)}?from=${from ?? "plan"}&week=${weekStart}`}
                aria-label="Previous day"
              >
                <Icon name="back" size={20} />
              </Link>
              <Link
                className="iconbtn"
                href={
                  addDays(date, 1) === today
                    ? "/"
                    : `/day/${addDays(date, 1)}?from=${from ?? "plan"}&week=${weekStart}`
                }
                aria-label="Next day"
              >
                <Icon name="chevron" size={20} />
              </Link>
            </span>
          }
        />

        <DayView
          bundle={bundle}
          isToday={isToday}
          longRunOptions={options.map((option) => ({ date: option.date, title: option.title }))}
        />
      </Shell>
      <Nav pending={pending} />
    </>
  );
}
