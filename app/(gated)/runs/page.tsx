import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { formatWithYear, todayISO, weekdayShort } from "@/lib/date";
import { formatDuration, formatMiles, formatPace } from "@/lib/format";
import { pendingCount } from "@/lib/coach/store";
import { getAllWorkoutLogs } from "@/lib/store";
import type { WorkoutLog } from "@/drizzle/schema";

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
  if (log.activeKcal != null) parts.push(`${log.activeKcal} cal`);
  return parts.join(" · ");
}

function metaLine(log: WorkoutLog): string | null {
  const parts: string[] = [];
  if (log.source === "healthkit") parts.push("Watch");
  if (log.feel) parts.push(log.feel);
  if (log.rpe) parts.push(`Effort ${log.rpe}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export default async function RunsPage() {
  const today = todayISO();
  const [pending, allLogs] = await Promise.all([pendingCount(), getAllWorkoutLogs()]);
  const logs = allLogs.filter(isLogged).slice().reverse();

  const totalMiles = logs.reduce((sum, log) => sum + log.distanceMi, 0);
  const totalKcal = logs.reduce((sum, log) => sum + (log.activeKcal ?? 0), 0);
  const hasKcal = logs.some((log) => log.activeKcal != null);

  return (
    <>
      <Shell>
        <AppBar title="Runs" back="/" pending={pending} />

        <section className="block block--tight">
          <div className="stack">
            <div className="card">
              <p className="tile__label">
                <Icon name="run" size={14} />
                Miles logged
              </p>
              <p className="tile__value" style={{ marginTop: "0.3rem" }}>
                {formatMiles(totalMiles)}
                <small>mi</small>
              </p>
              <p className="card__sub" style={{ marginTop: "0.35rem" }}>
                {logs.length === 0
                  ? "Nothing logged yet"
                  : `${logs.length} run${logs.length === 1 ? "" : "s"}`}
              </p>
            </div>

            <div className="bento bento--3">
              <div className="tile">
                <p className="tile__label">Runs</p>
                <p className="tile__value">{logs.length}</p>
              </div>
              <div className="tile">
                <p className="tile__label">Calories</p>
                <p className="tile__value">
                  {hasKcal ? totalKcal : "—"}
                  {hasKcal ? <small>kcal</small> : null}
                </p>
              </div>
              <div className="tile">
                <p className="tile__label">Latest</p>
                <p className="tile__value" style={{ fontSize: "1.05rem" }}>
                  {logs[0] ? (logs[0].date === today ? "Today" : formatWithYear(logs[0].date)) : "—"}
                </p>
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
                  <Icon name="run" size={20} />
                </span>
                <p className="small sub">
                  Runs from Apple Watch land here after sync. You can also log a session by hand on
                  Today.
                </p>
                <Link className="btn btn--ghost btn--sm" href="/settings/watch">
                  Apple Health sync
                </Link>
              </div>
            ) : (
              <div className="rows">
                {logs.map((log) => {
                  const href = log.date === today ? "/" : `/day/${log.date}`;
                  const meta = metaLine(log);
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
                          <span className="row__sub row__sub--wrap" style={{ textTransform: "capitalize" }}>
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
