import Link from "next/link";
import { logWater } from "@/app/actions";
import { AppBar } from "@/components/AppBar";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { WaterCard } from "@/components/WaterCard";
import { addDays, formatShort, todayISO, weekdayShort } from "@/lib/date";
import { pendingCount } from "@/lib/coach/store";
import { CUP_OZ, formatCups, ozToMl } from "@/lib/notify/water";
import { computeTargets } from "@/lib/nutrition/targets";
import type { WorkoutType } from "@/lib/plan/types";
import {
  getDayLog,
  getProfile,
  getWaterHistory,
  getWorkout,
  getWorkouts,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function WaterPage() {
  const today = todayISO();
  const [pending, profile, todayLog, history, todayWorkout] = await Promise.all([
    pendingCount(),
    getProfile(),
    getDayLog(today),
    getWaterHistory(),
    getWorkout(today),
  ]);

  const body = {
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    age: profile.age,
    sex: profile.sex,
  };

  const todayTarget = todayWorkout
    ? computeTargets(
        body,
        {
          type: todayWorkout.type as WorkoutType,
          distanceMi: todayWorkout.distanceMi,
          durationMin: todayWorkout.durationMin,
        },
        today,
      ).waterOz
    : 80;

  const oldest = history.length > 0 ? history[history.length - 1].date : today;
  const workouts = await getWorkouts(oldest, today);
  const workoutByDate = new Map(workouts.map((row) => [row.date, row]));

  function targetFor(date: string): number {
    const workout = workoutByDate.get(date);
    if (!workout) return 80;
    return computeTargets(
      body,
      {
        type: workout.type as WorkoutType,
        distanceMi: workout.distanceMi,
        durationMin: workout.durationMin,
      },
      date,
    ).waterOz;
  }

  const weekFrom = addDays(today, -6);
  const weekLogs = history.filter((row) => row.date >= weekFrom);
  const weekOz = weekLogs.reduce((sum, row) => sum + row.waterOz, 0);
  const weekCups = weekOz / CUP_OZ;
  const weekHit = weekLogs.filter((row) => row.waterOz >= targetFor(row.date) * 0.8).length;

  return (
    <>
      <Shell>
        <AppBar title="Water" back="/" pending={pending} />

        <section className="block block--tight">
          <div className="stack">
            <WaterCard
              action={logWater}
              date={today}
              ounces={todayLog.waterOz}
              target={todayTarget}
              historyHref={null}
            />

            <div className="bento bento--3">
              <div className="tile">
                <p className="tile__label">This week</p>
                <p className="tile__value">
                  {Number.isInteger(weekCups) ? weekCups : weekCups.toFixed(1)}
                  <small>cups</small>
                </p>
                <p className="tile__foot">
                  {weekOz} oz · {ozToMl(weekOz)} ml
                </p>
              </div>
              <div className="tile">
                <p className="tile__label">Hit target</p>
                <p className="tile__value">
                  {weekHit}
                  <small>d</small>
                </p>
              </div>
              <div className="tile">
                <p className="tile__label">Days logged</p>
                <p className="tile__value">{history.length}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">History</h2>
            <span className="label">Cups · oz · ml</span>
          </div>
          <div className="card">
            {history.length === 0 ? (
              <div className="empty">
                <span className="empty__icon">
                  <Icon name="water" size={20} />
                </span>
                <p className="small sub">Log a cup on Today and it shows up here.</p>
              </div>
            ) : (
              <div className="rows">
                {history.map((row) => {
                  const target = targetFor(row.date);
                  const pct = target > 0 ? Math.round((row.waterOz / target) * 100) : 0;
                  const href = row.date === today ? "/" : `/day/${row.date}`;
                  return (
                    <Link className="row" href={href} key={row.date}>
                      <span className="row__date">{weekdayShort(row.date)}</span>
                      <span
                        className={`row__lead${pct >= 100 ? " row__lead--good" : ""}`}
                      >
                        <Icon name="water" size={17} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">
                          {row.date === today ? "Today" : formatShort(row.date)}
                        </span>
                        <span className="row__sub row__sub--wrap">
                          {formatCups(row.waterOz)} of {formatCups(target)} cups · {row.waterOz} of{" "}
                          {target} oz · {ozToMl(row.waterOz)} of {ozToMl(target)} ml
                        </span>
                      </span>
                      <span className="row__meta">{Math.min(999, pct)}%</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </Shell>
      <Nav pending={pending} />
    </>
  );
}
