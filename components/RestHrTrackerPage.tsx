import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { formatWithYear, todayISO, weekdayShort } from "@/lib/date";
import { pendingCount } from "@/lib/coach/store";
import { getRestHrSummary } from "@/lib/health/read";

function detailLine(row: {
  sleepHr: number | null;
  walkingHr: number | null;
  hrMin: number | null;
  hrMax: number | null;
}): string {
  const parts: string[] = [];
  if (row.sleepHr !== null) parts.push(`Sleep ${row.sleepHr}`);
  if (row.walkingHr !== null) parts.push(`Walk ${row.walkingHr}`);
  if (row.hrMin !== null && row.hrMax !== null) parts.push(`${row.hrMin}–${row.hrMax}`);
  return parts.length > 0 ? `${parts.join(" · ")} bpm` : "bpm";
}

export async function RestHrTrackerPage() {
  const today = todayISO();
  const [pending, summary] = await Promise.all([pendingCount(), getRestHrSummary()]);
  const {
    history,
    todayHr,
    weekAvg,
    daysLogged,
    baseline,
    avgSleepHr,
    avgWalkingHr,
    avgHrMin,
    avgHrMax,
  } = summary;

  const delta =
    todayHr !== null && baseline !== null ? todayHr - baseline : null;

  return (
    <>
      <Shell>
        <AppBar title="Resting HR" back="/" pending={pending} />

        <section className="block block--tight">
          <div className="stack">
            <div className="card">
              <p className="tile__label">
                <Icon name="heart" size={14} />
                Resting HR
              </p>
              <p className="tile__value" style={{ marginTop: "0.3rem" }}>
                {todayHr !== null ? todayHr : "—"}
                {todayHr !== null ? <small>bpm</small> : null}
              </p>
              <p className="card__sub" style={{ marginTop: "0.35rem" }}>
                {todayHr !== null
                  ? delta !== null && delta !== 0
                    ? `Today · ${delta > 0 ? "+" : ""}${delta} vs normal`
                    : "Today"
                  : "Nothing for today yet"}
              </p>
            </div>

            <div className="bento bento--3">
              <div className="tile">
                <p className="tile__label">This week</p>
                <p className="tile__value">
                  {weekAvg !== null ? weekAvg : "—"}
                  {weekAvg !== null ? <small>bpm</small> : null}
                </p>
                <p className="tile__foot">Avg rest</p>
              </div>
              <div className="tile">
                <p className="tile__label">Days logged</p>
                <p className="tile__value">{daysLogged}</p>
                <p className="tile__foot">Since start</p>
              </div>
              <div className="tile">
                <p className="tile__label">Baseline</p>
                <p className="tile__value">
                  {baseline !== null ? baseline : "—"}
                  {baseline !== null ? <small>bpm</small> : null}
                </p>
                <p className="tile__foot">2-week normal</p>
              </div>
            </div>

            <div className="bento bento--3">
              <div className="tile">
                <p className="tile__label">Sleep HR</p>
                <p className="tile__value">
                  {avgSleepHr !== null ? avgSleepHr : "—"}
                  {avgSleepHr !== null ? <small>bpm</small> : null}
                </p>
                <p className="tile__foot">Avg / day</p>
              </div>
              <div className="tile">
                <p className="tile__label">Walking</p>
                <p className="tile__value">
                  {avgWalkingHr !== null ? avgWalkingHr : "—"}
                  {avgWalkingHr !== null ? <small>bpm</small> : null}
                </p>
                <p className="tile__foot">Avg / day</p>
              </div>
              <div className="tile">
                <p className="tile__label">Day range</p>
                <p className="tile__value">
                  {avgHrMin !== null && avgHrMax !== null ? `${avgHrMin}–${avgHrMax}` : "—"}
                </p>
                <p className="tile__foot">Avg min–max</p>
              </div>
            </div>
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">History</h2>
            <span className="label">Days</span>
          </div>
          <div className="card">
            {history.length === 0 ? (
              <div className="empty">
                <span className="empty__icon">
                  <Icon name="heart" size={20} />
                </span>
                <p className="small sub">
                  Resting heart rate, walking average, and daytime range land here after sync —
                  only days since this training block started.
                </p>
                <Link className="btn btn--ghost btn--sm" href="/settings/watch">
                  Apple Health sync
                </Link>
              </div>
            ) : (
              <div className="rows">
                {history.map((row) => {
                  const href = row.date === today ? "/" : `/day/${row.date}`;
                  return (
                    <Link className="row" href={href} key={row.date}>
                      <span className="row__date">{weekdayShort(row.date)}</span>
                      <span className="row__lead row__lead--accent">
                        <Icon name="heart" size={17} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">
                          {row.date === today ? "Today" : formatWithYear(row.date)}
                        </span>
                        <span className="row__sub row__sub--wrap">{detailLine(row)}</span>
                      </span>
                      <span className="row__meta">{row.restingHr ?? "—"}</span>
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
