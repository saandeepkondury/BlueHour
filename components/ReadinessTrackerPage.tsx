import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { ReadinessChart } from "@/components/ReadinessChart";
import { Ring } from "@/components/Ring";
import { Shell } from "@/components/Shell";
import { formatShort, formatWithYear, todayISO, weekdayShort } from "@/lib/date";
import { pendingCount } from "@/lib/coach/store";
import { getReadinessHistory, type ReadinessDay } from "@/lib/health/read";

function titleFor(day: ReadinessDay | null): string {
  if (!day || day.score === null) return "No score yet";
  if (day.label === "race ready") return "Race ready";
  if (day.label === "on track") return "On track";
  return "Building";
}

function toneFor(score: number | null): "good" | "accent" | "bad" {
  if (score === null) return "accent";
  if (score >= 75) return "good";
  if (score >= 56) return "accent";
  return "bad";
}

function detailLine(day: ReadinessDay): string {
  const parts: string[] = [];
  if (day.longestMi > 0) parts.push(`Longest ${day.longestMi} mi`);
  if (day.weekMi > 0) parts.push(`Week ${day.weekMi} mi`);
  if (day.daysToRace !== null) parts.push(`${day.daysToRace}d to race`);
  return parts.length > 0 ? parts.join(" · ") : "Waiting on Watch data";
}

export async function ReadinessTrackerPage() {
  const today = todayISO();
  const [pending, history] = await Promise.all([pendingCount(), getReadinessHistory()]);
  const { today: todayEntry, days, high, low, avg, delta, startDate } = history;
  const scoredDays = days.filter((day) => day.score !== null);

  return (
    <>
      <Shell>
        <AppBar title="Race readiness" back="/" pending={pending} />

        <section className="block block--tight">
          <div className="stack">
            <div className="card">
              <div className="row-between">
                <div>
                  <p className="label">Today</p>
                  <p className="card__title" style={{ marginTop: "0.3rem" }}>
                    {titleFor(todayEntry)}
                  </p>
                  <p className="card__sub">
                    {todayEntry?.score != null
                      ? delta !== null && delta !== 0
                        ? `${delta > 0 ? "+" : ""}${delta} vs yesterday · since ${formatShort(startDate)}`
                        : `Since ${formatShort(startDate)}`
                      : `Scores start when Watch data lands · since ${formatShort(startDate)}`}
                  </p>
                </div>
                {todayEntry?.score != null ? (
                  <Ring
                    pct={todayEntry.score}
                    tone={toneFor(todayEntry.score)}
                    size={72}
                    thickness={7}
                    value={todayEntry.score}
                    caption="score"
                    label={`Race readiness ${todayEntry.score} of 100`}
                  />
                ) : (
                  <span className="row__lead row__lead--accent">
                    <Icon name="chart" size={19} />
                  </span>
                )}
              </div>

              <hr className="card__divide" />
              <ReadinessChart days={days} />
              <div className="readiness-chart__legend">
                <span>
                  <i className="readiness-chart__swatch readiness-chart__swatch--band" />
                  On track 56+
                </span>
                <span>
                  <i className="readiness-chart__swatch readiness-chart__swatch--good" />
                  Race ready 75+
                </span>
              </div>
            </div>

            <div className="bento bento--3">
              <div className="tile">
                <p className="tile__label">High</p>
                <p className="tile__value">{high ?? "—"}</p>
                <p className="tile__foot">This block</p>
              </div>
              <div className="tile">
                <p className="tile__label">Avg</p>
                <p className="tile__value">{avg ?? "—"}</p>
                <p className="tile__foot">Since start</p>
              </div>
              <div className="tile">
                <p className="tile__label">Low</p>
                <p className="tile__value">{low ?? "—"}</p>
                <p className="tile__foot">This block</p>
              </div>
            </div>
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">Every day</h2>
            <span className="label">Newest first</span>
          </div>
          <div className="card">
            {scoredDays.length === 0 ? (
              <div className="empty">
                <span className="empty__icon">
                  <Icon name="chart" size={20} />
                </span>
                <p className="small sub">
                  Daily scores build from sleep, resting HR, HRV, and runs — starting{" "}
                  {formatShort(startDate)}.
                </p>
                <Link className="btn btn--ghost btn--sm" href="/settings/watch">
                  Apple Health sync
                </Link>
              </div>
            ) : (
              <div className="rows">
                {days.map((day) => {
                  const href = day.date === today ? "/" : `/day/${day.date}`;
                  return (
                    <Link className="row" href={href} key={day.date}>
                      <span className="row__date">{weekdayShort(day.date)}</span>
                      <span
                        className={`row__lead${
                          day.score !== null && day.score >= 75
                            ? " row__lead--good"
                            : " row__lead--accent"
                        }`}
                      >
                        <Icon name="chart" size={17} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">
                          {day.date === today ? "Today" : formatWithYear(day.date)}
                        </span>
                        <span className="row__sub row__sub--wrap">{detailLine(day)}</span>
                      </span>
                      <span className="row__meta">
                        {day.score !== null ? day.score : "—"}
                      </span>
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
