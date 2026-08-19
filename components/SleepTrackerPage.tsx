import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { HealthSharingEmpty, HealthSharingTip } from "@/components/HealthSharingEmpty";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { formatWithYear, todayISO, weekdayShort } from "@/lib/date";
import { pendingCount } from "@/lib/coach/store";
import { formatSleep, getSleepSummary, lastSync } from "@/lib/health/read";

function stageLine(row: {
  remMin: number | null;
  coreMin: number | null;
  deepMin: number | null;
  sleepHr: number | null;
}): string {
  const parts: string[] = [];
  if (row.remMin !== null) parts.push(`REM ${formatSleep(row.remMin)}`);
  if (row.coreMin !== null) parts.push(`Core ${formatSleep(row.coreMin)}`);
  if (row.deepMin !== null) parts.push(`Deep ${formatSleep(row.deepMin)}`);
  if (row.sleepHr !== null) parts.push(`${row.sleepHr} bpm`);
  return parts.length > 0 ? parts.join(" · ") : "Asleep";
}

export async function SleepTrackerPage() {
  const today = todayISO();
  const [pending, summary, sync] = await Promise.all([
    pendingCount(),
    getSleepSummary(),
    lastSync(),
  ]);
  const synced = Boolean(sync);
  const { history, todayMin, weekAvgMin, daysLogged, avgSleepHr, avgRemMin, avgCoreMin, avgDeepMin } =
    summary;

  return (
    <>
      <Shell>
        <AppBar title="Sleep" back="/" pending={pending} />

        <section className="block block--tight">
          <div className="stack">
            <div className="card">
              <p className="tile__label">
                <Icon name="moon" size={14} />
                Sleep
              </p>
              <p className="tile__value" style={{ marginTop: "0.3rem" }}>
                {todayMin !== null ? formatSleep(todayMin) : "—"}
                {todayMin !== null ? <small>asleep</small> : null}
              </p>
              <p className="card__sub" style={{ marginTop: "0.35rem" }}>
                {todayMin !== null
                  ? "Today"
                  : synced
                    ? "Permission or Watch not writing yet"
                    : "Nothing for today yet"}
              </p>
            </div>

            <HealthSharingTip
              focus="sleep"
              synced={synced}
              missing={todayMin === null && history.length > 0}
            />

            <div className="bento bento--3">
              <div className="tile">
                <p className="tile__label">This week</p>
                <p className="tile__value">{weekAvgMin !== null ? formatSleep(weekAvgMin) : "—"}</p>
                <p className="tile__foot">Avg night</p>
              </div>
              <div className="tile">
                <p className="tile__label">Days logged</p>
                <p className="tile__value">{daysLogged}</p>
                <p className="tile__foot">Since start</p>
              </div>
              <div className="tile">
                <p className="tile__label">Sleep HR</p>
                <p className="tile__value">
                  {avgSleepHr !== null ? avgSleepHr : "—"}
                  {avgSleepHr !== null ? <small>bpm</small> : null}
                </p>
                <p className="tile__foot">Avg while asleep</p>
              </div>
            </div>

            <div className="bento bento--3">
              <div className="tile">
                <p className="tile__label">REM</p>
                <p className="tile__value">{avgRemMin !== null ? formatSleep(avgRemMin) : "—"}</p>
                <p className="tile__foot">Avg / day</p>
              </div>
              <div className="tile">
                <p className="tile__label">Core</p>
                <p className="tile__value">{avgCoreMin !== null ? formatSleep(avgCoreMin) : "—"}</p>
                <p className="tile__foot">Avg / day</p>
              </div>
              <div className="tile">
                <p className="tile__label">Deep</p>
                <p className="tile__value">{avgDeepMin !== null ? formatSleep(avgDeepMin) : "—"}</p>
                <p className="tile__foot">Avg / day</p>
              </div>
            </div>
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">History</h2>
            <span className="label">Nights</span>
          </div>
          <div className="card">
            {history.length === 0 ? (
              <HealthSharingEmpty icon="moon" focus="sleep" synced={synced} />
            ) : (
              <div className="rows">
                {history.map((row) => {
                  const href = row.date === today ? "/" : `/day/${row.date}`;
                  return (
                    <Link className="row" href={href} key={row.date}>
                      <span className="row__date">{weekdayShort(row.date)}</span>
                      <span className="row__lead row__lead--accent">
                        <Icon name="moon" size={17} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">
                          {row.date === today ? "Today" : formatWithYear(row.date)}
                        </span>
                        <span className="row__sub row__sub--wrap">{stageLine(row)}</span>
                      </span>
                      <span className="row__meta">{formatSleep(row.asleepMin ?? 0)}</span>
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
