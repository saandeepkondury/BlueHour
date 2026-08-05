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
import { closeOutMissedDays, longRunOptions } from "@/lib/plan/adapt";
import { getAllWorkouts, getDayBundle, getProfile } from "@/lib/store";
import { pendingSuggestions, refreshCoach } from "@/lib/coach/store";
import type { Phase } from "@/lib/plan/types";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const today = todayISO();
  const current = await getProfile();
  await closeOutMissedDays(today);

  // Guardrail suggestions are cheap and deterministic, so they run on every open.
  // The model is only asked when you press the button on the coach screen.
  await refreshCoach(current, { useModel: false });

  const [bundle, pending] = await Promise.all([getDayBundle(today), pendingSuggestions()]);
  const all = await getAllWorkouts();
  const totalWeeks = all.length > 0 ? Math.max(...all.map((day) => day.week)) : 0;

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
        />

        {pending.length > 0 ? (
          <div style={{ paddingTop: "0.875rem" }}>
            <Link className="banner cardlink" href="/coach">
              <span className="row__lead row__lead--accent">
                <Icon name="coach" size={18} />
              </span>
              <span className="banner__body">
                <span className="banner__title">{pending[0].title}</span>
                <span className="banner__sub">
                  {pending.length === 1 ? "Tap to review" : `${pending.length} suggestions waiting`}
                </span>
              </span>
              <Icon name="chevron" size={16} />
            </Link>
          </div>
        ) : null}

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
