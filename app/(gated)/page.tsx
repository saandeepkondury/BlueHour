import Link from "next/link";
import { DayView } from "@/components/DayView";
import { Nav } from "@/components/Nav";
import { RidgeHeader } from "@/components/RidgeHeader";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { Shell } from "@/components/Shell";
import { formatLong, startOfWeek, todayISO } from "@/lib/date";
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
        <Shell showBrand={false}>
          <RidgeHeader
            today={today}
            raceDate={current.raceDate}
            raceName={current.raceName}
            phase="base"
            week={0}
            totalWeeks={totalWeeks}
          />
          <section className="sec">
            <h2 className="sec-title">
              Nothing on the <em>calendar</em> for today
            </h2>
            <p className="sec-intro">
              {first && first.date > today
                ? `The block opens ${formatLong(first.date)}. Until then, walk, sleep, and let the plan wait.`
                : "The race has been run. Set a new date in Settings when you are ready for the next one."}
            </p>
            <div className="btn-row">
              <Link className="btn" href="/plan">
                See the plan
              </Link>
              <Link className="btn btn--ghost" href="/settings">
                Settings
              </Link>
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
      <Shell showBrand={false}>
        <RidgeHeader
          today={today}
          raceDate={current.raceDate}
          raceName={current.raceName}
          phase={bundle.workout.phase as Phase}
          week={bundle.workout.week}
          totalWeeks={totalWeeks}
        />

        {pending.length > 0 ? (
          <section className="sec">
            <p className="sec-label">From the coach</p>
            <article className="plaque plaque--accent">
              <p className="plaque-title" style={{ fontSize: "1.35rem" }}>
                {pending[0].title}
              </p>
              <p className="plaque-note">{pending[0].rationale}</p>
              <div className="btn-row">
                <Link className="btn btn--accent btn--small" href="/coach">
                  {pending.length === 1
                    ? "Review it"
                    : `Review all ${pending.length} suggestions`}
                </Link>
              </div>
            </article>
          </section>
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
