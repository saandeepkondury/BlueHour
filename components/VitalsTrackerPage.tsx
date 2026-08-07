import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { Icon, type IconName } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { addDays, formatWithYear, todayISO, weekdayShort } from "@/lib/date";
import { pendingCount } from "@/lib/coach/store";
import {
  formatSleep,
  getVitalsHistory,
  meanOf,
  type VitalMetric,
} from "@/lib/health/read";
import type { HealthDay } from "@/drizzle/schema";

const META: Record<
  VitalMetric,
  {
    title: string;
    icon: IconName;
    unit: string;
    empty: string;
    historyLabel: string;
    value: (row: HealthDay) => number;
    display: (value: number) => string;
    weekLabel: string;
  }
> = {
  sleep: {
    title: "Sleep",
    icon: "moon",
    unit: "asleep",
    empty: "Sleep from Apple Health shows up here once the Watch syncs a night.",
    historyLabel: "Nights",
    value: (row) => row.asleepMin ?? 0,
    display: (value) => formatSleep(value),
    weekLabel: "Avg night",
  },
  rest_hr: {
    title: "Resting HR",
    icon: "heart",
    unit: "bpm",
    empty: "Resting heart rate lands here from Apple Health after a sync.",
    historyLabel: "Days",
    value: (row) => row.restingHr ?? 0,
    display: (value) => String(value),
    weekLabel: "Avg rest",
  },
  hrv: {
    title: "HRV",
    icon: "pulse",
    unit: "ms",
    empty: "Heart-rate variability from your Watch shows up here after a sync.",
    historyLabel: "Days",
    value: (row) => (row.hrvMs === null ? 0 : Math.round(row.hrvMs)),
    display: (value) => String(Math.round(value)),
    weekLabel: "Avg HRV",
  },
};

export async function VitalsTrackerPage({ metric }: { metric: VitalMetric }) {
  const meta = META[metric];
  const today = todayISO();
  const [pending, history] = await Promise.all([pendingCount(), getVitalsHistory(metric)]);

  const todayRow = history.find((row) => row.date === today) ?? null;
  const todayValue = todayRow ? meta.value(todayRow) : null;

  const weekFrom = addDays(today, -6);
  const weekRows = history.filter((row) => row.date >= weekFrom);
  const weekAvg = meanOf(weekRows.map(meta.value));
  const allAvg = meanOf(history.map(meta.value));

  return (
    <>
      <Shell>
        <AppBar title={meta.title} back="/" pending={pending} />

        <section className="block block--tight">
          <div className="stack">
            <div className="card">
              <p className="tile__label">
                <Icon name={meta.icon} size={14} />
                {meta.title}
              </p>
              <p className="tile__value" style={{ marginTop: "0.3rem" }}>
                {todayValue !== null ? meta.display(todayValue) : "—"}
                {todayValue !== null ? <small>{meta.unit}</small> : null}
              </p>
              <p className="card__sub" style={{ marginTop: "0.35rem" }}>
                {todayValue !== null ? "Today" : "Nothing for today yet"}
              </p>
            </div>

            <div className="bento bento--3">
              <div className="tile">
                <p className="tile__label">This week</p>
                <p className="tile__value">
                  {weekAvg !== null ? meta.display(weekAvg) : "—"}
                  {weekAvg !== null && metric !== "sleep" ? <small>{meta.unit}</small> : null}
                </p>
                <p className="tile__foot">{meta.weekLabel}</p>
              </div>
              <div className="tile">
                <p className="tile__label">All-time avg</p>
                <p className="tile__value">
                  {allAvg !== null ? meta.display(allAvg) : "—"}
                  {allAvg !== null && metric !== "sleep" ? <small>{meta.unit}</small> : null}
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
            <span className="label">{meta.historyLabel}</span>
          </div>
          <div className="card">
            {history.length === 0 ? (
              <div className="empty">
                <span className="empty__icon">
                  <Icon name={meta.icon} size={20} />
                </span>
                <p className="small sub">{meta.empty}</p>
                <Link className="btn btn--ghost btn--sm" href="/settings/watch">
                  Apple Health sync
                </Link>
              </div>
            ) : (
              <div className="rows">
                {history.map((row) => {
                  const value = meta.value(row);
                  const href = row.date === today ? "/" : `/day/${row.date}`;
                  return (
                    <Link className="row" href={href} key={row.date}>
                      <span className="row__date">{weekdayShort(row.date)}</span>
                      <span className="row__lead row__lead--accent">
                        <Icon name={meta.icon} size={17} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">
                          {row.date === today ? "Today" : formatWithYear(row.date)}
                        </span>
                        <span className="row__sub row__sub--wrap">
                          {metric === "sleep" ? "Asleep" : meta.unit}
                        </span>
                      </span>
                      <span className="row__meta">{meta.display(value)}</span>
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
