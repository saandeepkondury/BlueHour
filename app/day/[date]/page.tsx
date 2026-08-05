import Link from "next/link";
import { notFound } from "next/navigation";
import { DayView } from "@/components/DayView";
import { Nav } from "@/components/Nav";
import { addDays, formatLong, startOfWeek, todayISO } from "@/lib/date";
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
    <main className="shell">
      <header className="sec">
        <p className="sec-label">Plan · {formatLong(date)}</p>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <Link className="btn btn--ghost btn--small" href={`/day/${addDays(date, -1)}`}>
            ← Previous
          </Link>
          <Link className="btn btn--ghost btn--small" href="/plan">
            Full plan
          </Link>
          <Link className="btn btn--ghost btn--small" href={`/day/${addDays(date, 1)}`}>
            Next →
          </Link>
        </div>
      </header>

      <DayView
        bundle={bundle}
        isToday={date === today}
        longRunOptions={options.map((option) => ({ date: option.date, title: option.title }))}
      />

      <Nav />
    </main>
  );
}
