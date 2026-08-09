import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { addDays, formatShort, formatWithYear, startOfWeek, todayISO, weekdayShort } from "@/lib/date";
import { formatDuration, formatMiles, formatPace, formatPacePerMi } from "@/lib/format";
import { pendingCount } from "@/lib/coach/store";
import { TYPE_LABEL, isRun, type WorkoutType } from "@/lib/plan/types";
import { getProfile, getTrainingWorkoutLogs, getWorkouts } from "@/lib/store";
import type { Workout, WorkoutLog } from "@/drizzle/schema";

export const dynamic = "force-dynamic";

function isLogged(log: WorkoutLog): boolean {
  return log.distanceMi > 0 || (log.durationSec ?? 0) > 0;
}

function detailLine(log: WorkoutLog): string {
  const parts = [
    `${formatMiles(log.distanceMi)} mi`,
    formatDuration(log.durationSec),
    formatPace(log.durationSec, log.distanceMi),
  ];
  if (log.avgHr != null) parts.push(`HR ${log.avgHr}`);
  return parts.join(" · ");
}

function metaLine(log: WorkoutLog, planned: Workout | undefined): string | null {
  const parts: string[] = [];
  if (planned && isRun(planned.type as WorkoutType)) {
    parts.push(TYPE_LABEL[planned.type as WorkoutType]);
    if (planned.distanceMi > 0 && log.distanceMi > 0) {
      const pct = Math.round((log.distanceMi / planned.distanceMi) * 100);
      parts.push(`${formatMiles(log.distanceMi)} of ${formatMiles(planned.distanceMi)} mi · ${pct}%`);
    }
  } else if (log.source === "healthkit") {
    parts.push("Watch · outside plan");
  }
  if (log.feel) parts.push(log.feel);
  if (log.rpe) parts.push(`Effort ${log.rpe}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function weekMiles(logs: WorkoutLog[], weekStart: string): number {
  const weekEnd = addDays(weekStart, 6);
  return round1(
    logs
      .filter((log) => log.date >= weekStart && log.date <= weekEnd)
      .reduce((sum, log) => sum + log.distanceMi, 0),
  );
}

function avgPaceSec(logs: WorkoutLog[]): number | null {
  const paced = logs.filter(
    (log) => (log.distanceMi ?? 0) >= 0.5 && (log.durationSec ?? 0) >= 60,
  );
  if (paced.length === 0) return null;
  return Math.round(
    paced.reduce((sum, log) => sum + log.durationSec! / log.distanceMi!, 0) / paced.length,
  );
}

function avgHr(logs: WorkoutLog[]): number | null {
  const withHr = logs.filter((log) => log.avgHr != null && log.avgHr > 0);
  if (withHr.length === 0) return null;
  return Math.round(withHr.reduce((sum, log) => sum + log.avgHr!, 0) / withHr.length);
}

function longestMi(logs: WorkoutLog[]): number {
  return round1(logs.reduce((max, log) => Math.max(max, log.distanceMi), 0));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export default async function RunsPage() {
  const today = todayISO();
  const thisWeek = startOfWeek(today);
  const priorWeek = addDays(thisWeek, -7);
  const recentFrom = addDays(today, -13);

  const [pending, profile, allLogs] = await Promise.all([
    pendingCount(),
    getProfile(),
    getTrainingWorkoutLogs(),
  ]);
  const logs = allLogs.filter(isLogged).slice().reverse();

  const planned =
    logs.length > 0
      ? await getWorkouts(logs[logs.length - 1].date, logs[0].date)
      : [];
  const plannedByDate = new Map(planned.map((workout) => [workout.date, workout]));

  const totalMiles = round1(logs.reduce((sum, log) => sum + log.distanceMi, 0));
  const thisWeekMi = weekMiles(logs, thisWeek);
  const priorWeekMi = weekMiles(logs, priorWeek);
  const weekDelta = round1(thisWeekMi - priorWeekMi);
  const peakMi = longestMi(logs);
  const recent = logs.filter((log) => log.date >= recentFrom);
  const recentPace = avgPaceSec(recent);
  const recentHr = avgHr(recent);

  const weekDeltaLabel =
    priorWeekMi <= 0 && thisWeekMi <= 0
      ? "vs last week"
      : weekDelta === 0
        ? "same as last week"
        : weekDelta > 0
          ? `+${formatMiles(weekDelta)} vs last week`
          : `${formatMiles(weekDelta)} vs last week`;

  return (
    <>
      <Shell>
        <AppBar title="Runs" back="/" pending={pending} />

        <section className="block block--tight">
          <div className="stack">
            <div className="card">
              <p className="tile__label">
                <Icon name="run" size={14} />
                Miles since start
              </p>
              <p className="tile__value" style={{ marginTop: "0.3rem" }}>
                {formatMiles(totalMiles)}
                <small>mi</small>
              </p>
              <p className="card__sub" style={{ marginTop: "0.35rem" }}>
                {logs.length === 0
                  ? `Training from ${formatShort(profile.startDate)} · nothing logged yet`
                  : `${logs.length} run${logs.length === 1 ? "" : "s"} · since ${formatShort(profile.startDate)}`}
              </p>
            </div>

            <div className="bento bento--3">
              <div className="tile">
                <p className="tile__label">This week</p>
                <p className="tile__value">
                  {formatMiles(thisWeekMi)}
                  <small>mi</small>
                </p>
                <p className="tile__foot">{weekDeltaLabel}</p>
              </div>
              <div className="tile">
                <p className="tile__label">Longest</p>
                <p className="tile__value">
                  {peakMi > 0 ? formatMiles(peakMi) : "—"}
                  {peakMi > 0 ? <small>mi</small> : null}
                </p>
                <p className="tile__foot">in this block</p>
              </div>
              <div className="tile">
                <p className="tile__label">{recentPace != null ? "Avg pace" : "Avg HR"}</p>
                <p className="tile__value" style={{ fontSize: recentPace != null ? "1.25rem" : undefined }}>
                  {recentPace != null
                    ? `${formatPacePerMi(recentPace)}`
                    : recentHr != null
                      ? recentHr
                      : "—"}
                  {recentPace != null ? <small>/mi</small> : null}
                  {recentPace == null && recentHr != null ? <small>bpm</small> : null}
                </p>
                <p className="tile__foot">last 14 days</p>
              </div>
            </div>
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">History</h2>
            <span className="label">Newest first</span>
          </div>
          <div className="card">
            {logs.length === 0 ? (
              <div className="empty">
                <span className="empty__icon">
                  <Icon name="watch" size={20} />
                </span>
                <p className="small sub">
                  Walk and run workouts from Apple Watch land here after sync — only from{" "}
                  {formatShort(profile.startDate)} onward.
                </p>
                <Link className="btn btn--ghost btn--sm" href="/settings/watch">
                  Apple Health sync
                </Link>
              </div>
            ) : (
              <div className="rows">
                {logs.map((log) => {
                  const href = log.date === today ? "/" : `/day/${log.date}`;
                  const plannedDay = plannedByDate.get(log.date);
                  const meta = metaLine(log, plannedDay);
                  return (
                    <Link className="row" href={href} key={log.date}>
                      <span className="row__date">{weekdayShort(log.date)}</span>
                      <span
                        className={`row__lead${
                          log.source === "healthkit" ? " row__lead--good" : " row__lead--accent"
                        }`}
                      >
                        <Icon name={log.source === "healthkit" ? "watch" : "run"} size={17} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">
                          {log.date === today ? "Today" : formatWithYear(log.date)}
                        </span>
                        <span className="row__sub row__sub--wrap">{detailLine(log)}</span>
                        {meta ? (
                          <span
                            className="row__sub row__sub--wrap"
                            style={{ textTransform: "capitalize" }}
                          >
                            {meta}
                          </span>
                        ) : null}
                      </span>
                      <Icon name="chevron" size={14} />
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
