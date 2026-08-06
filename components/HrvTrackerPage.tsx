import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { formatShort, todayISO, weekdayShort } from "@/lib/date";
import { pendingCount } from "@/lib/coach/store";
import { getHrvSummary } from "@/lib/health/read";

function detailLine(row: {
  hrvMin: number | null;
  hrvMax: number | null;
  hrvCount: number | null;
  restingHr: number | null;
}): string {
  const parts: string[] = [];
  if (row.hrvMin !== null && row.hrvMax !== null) {
    parts.push(`${Math.round(row.hrvMin)}–${Math.round(row.hrvMax)} ms`);
  }
  if (row.hrvCount !== null && row.hrvCount > 1) {
    parts.push(`${row.hrvCount} readings`);
  }
  if (row.restingHr !== null) parts.push(`Rest ${row.restingHr}`);
  return parts.length > 0 ? parts.join(" · ") : "ms";
}

export async function HrvTrackerPage() {
  const today = todayISO();
  const [pending, summary] = await Promise.all([pendingCount(), getHrvSummary()]);
  const {
    history,
    todayMs,
    weekAvg,
    daysLogged,
    baseline,
    avgHrvMin,
    avgHrvMax,
    avgHrvCount,
    avgRestingHr,
  } = summary;

  const delta =
    todayMs !== null && baseline !== null ? todayMs - baseline : null;

  return (
    <>
      <Shell>
        <AppBar title="HRV" back="/" pending={pending} />

        <section className="block block--tight">
          <div className="stack">
            <div className="card">
              <p className="tile__label">
                <Icon name="pulse" size={14} />
                HRV
              </p>
              <p className="tile__value" style={{ marginTop: "0.3rem" }}>
                {todayMs !== null ? todayMs : "—"}
                {todayMs !== null ? <small>ms</small> : null}
              </p>
              <p className="card__sub" style={{ marginTop: "0.35rem" }}>
                {todayMs !== null
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
                  {weekAvg !== null ? <small>ms</small> : null}
                </p>
                <p className="tile__foot">Avg HRV</p>
              </div>
              <div className="tile">
                <p className="tile__label">Days logged</p>
                <p className="tile__value">{daysLogged}</p>
              </div>
              <div className="tile">
                <p className="tile__label">Baseline</p>
                <p className="tile__value">
                  {baseline !== null ? baseline : "—"}
                  {baseline !== null ? <small>ms</small> : null}
                </p>
                <p className="tile__foot">2-week normal</p>
              </div>
            </div>

            <div className="bento bento--3">
              <div className="tile">
                <p className="tile__label">Day low</p>
                <p className="tile__value">
                  {avgHrvMin !== null ? avgHrvMin : "—"}
                  {avgHrvMin !== null ? <small>ms</small> : null}
                </p>
                <p className="tile__foot">Avg / day</p>
              </div>
              <div className="tile">
                <p className="tile__label">Day high</p>
                <p className="tile__value">
                  {avgHrvMax !== null ? avgHrvMax : "—"}
                  {avgHrvMax !== null ? <small>ms</small> : null}
                </p>
                <p className="tile__foot">Avg / day</p>
              </div>
              <div className="tile">
                <p className="tile__label">Readings</p>
                <p className="tile__value">{avgHrvCount !== null ? avgHrvCount : "—"}</p>
                <p className="tile__foot">
                  {avgRestingHr !== null ? `Rest ${avgRestingHr} bpm` : "Avg / day"}
                </p>
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
                  <Icon name="pulse" size={20} />
                </span>
                <p className="small sub">
                  Heart-rate variability from your Watch shows up here after a sync — daily average
                  plus the low–high range across readings.
                </p>
                <Link className="btn btn--ghost btn--sm" href="/settings/watch">
                  Apple Health sync
                </Link>
              </div>
            ) : (
              <div className="rows">
                {history.map((row) => {
                  const href = row.date === today ? "/" : `/day/${row.date}`;
                  const value =
                    row.hrvMs === null || row.hrvMs === undefined ? "—" : Math.round(row.hrvMs);
                  return (
                    <Link className="row" href={href} key={row.date}>
                      <span className="row__date">{weekdayShort(row.date)}</span>
                      <span className="row__lead row__lead--accent">
                        <Icon name="pulse" size={17} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">
                          {row.date === today ? "Today" : formatShort(row.date)}
                        </span>
                        <span className="row__sub">{detailLine(row)}</span>
                      </span>
                      <span className="row__meta">{value}</span>
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
