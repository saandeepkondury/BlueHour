import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { BrandRow } from "@/components/Brand";
import { DayView } from "@/components/DayView";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { Shell } from "@/components/Shell";
import { TodayHero } from "@/components/TodayHero";
import { formatShort, startOfWeek, todayISO } from "@/lib/date";
import { personalBestPace } from "@/lib/format";
import { closeOutMissedDays, longRunOptions } from "@/lib/plan/adapt";
import { getAllWorkouts, getDayBundle, getProfile, getTrainingWorkoutLogs } from "@/lib/store";
import { pendingSuggestions, refreshCoach } from "@/lib/coach/store";
import type { Phase } from "@/lib/plan/types";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const today = todayISO();
  const current = await getProfile();
  await closeOutMissedDays(today);

  // Guardrails are cheap. The model runs at most once a day, from cron or Coach.
  await refreshCoach(current, { skipModel: true });

  const [bundle, pending, runLogs] = await Promise.all([
    getDayBundle(today),
    pendingSuggestions(),
    getTrainingWorkoutLogs(),
  ]);
  const all = await getAllWorkouts();
  const totalWeeks = all.length > 0 ? Math.max(...all.map((day) => day.week)) : 0;
  const bestPace = personalBestPace(runLogs);

  if (!bundle) {
    const first = all[0];
    return (
      <>
        <Shell>
          <AppBar title={<BrandRow />} pending={pending.length} />
          <TodayHero
            today={today}
            raceDate={current.raceDate}
            raceName={current.raceName}
            phase="base"
            week={0}
            totalWeeks={totalWeeks}
            bestPace={bestPace}
          />
          <section className="block">
            <div className="card">
              <div className="empty">
                <span className="empty__icon">
                  <Icon name="rest" size={20} />
                </span>
                <p className="card__title">Nothing scheduled today</p>
                <p className="small sub">
                  {first && first.date > today
                    ? `The block opens ${formatShort(first.date)}.`
                    : "Set a new race date when you are ready for the next one."}
                </p>
                <div className="btnrow">
                  <Link className="btn btn--primary btn--sm" href="/plan">
                    See the plan
                  </Link>
                  <Link className="btn btn--ghost btn--sm" href="/settings">
                    Settings
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </Shell>
        <Nav pending={pending.length} />
        <ServiceWorkerRegister />
      </>
    );
  }

  const options = await longRunOptions(startOfWeek(today));

  return (
    <>
      <Shell>
        <AppBar title={<BrandRow />} pending={pending.length} />
        <TodayHero
          today={today}
          raceDate={current.raceDate}
          raceName={current.raceName}
          phase={bundle.workout.phase as Phase}
          week={bundle.workout.week}
          totalWeeks={totalWeeks}
          bestPace={bestPace}
        />

        <DayView
          bundle={bundle}
          isToday
          longRunOptions={options.map((day) => ({ date: day.date, title: day.title }))}
        />
      </Shell>
      <Nav pending={pending.length} />
      <ServiceWorkerRegister />
    </>
  );
}
