import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Ring } from "@/components/Ring";
import { formatShort, todayISO } from "@/lib/date";
import { hasVitals, type Recovery } from "@/lib/health/read";

function hoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/**
 * Watch data as four glanceable tiles led by one score. Nothing here changes
 * the plan — the coach proposes, you decide.
 */
export function ReadinessCard({
  recovery,
  date,
}: {
  recovery: Recovery;
  /** Calendar day being viewed — keeps copy honest on past days. */
  date: string;
}) {
  const { day, score, label, baselineRestingHr, advisory, vitalsDate, lastSyncAt } = recovery;
  const isToday = date === todayISO();
  const stale = Boolean(vitalsDate && vitalsDate !== date);

  if (!hasVitals(day)) {
    if (!isToday) {
      return (
        <div className="banner">
          <span className="row__lead row__lead--accent">
            <Icon name="watch" size={18} />
          </span>
          <span className="banner__body">
            <span className="banner__title">No Watch data for this day</span>
            <span className="banner__sub">
              Sleep, rest HR, and HRV for {formatShort(date)} were not synced.
            </span>
          </span>
        </div>
      );
    }

    return (
      <Link className="banner cardlink" href="/settings/watch">
        <span className="row__lead row__lead--accent">
          <Icon name="watch" size={18} />
        </span>
        <span className="banner__body">
          {lastSyncAt ? (
            <>
              <span className="banner__title">Waiting on today&apos;s sleep &amp; rest HR</span>
              <span className="banner__sub">
                Watch is connected — sync again once this morning&apos;s readings land, or log them
                by hand.
              </span>
            </>
          ) : (
            <>
              <span className="banner__title">Connect your Watch</span>
              <span className="banner__sub">Sleep, HRV and runs land here on their own.</span>
            </>
          )}
        </span>
        <Icon name="chevron" size={16} />
      </Link>
    );
  }

  const tone =
    score === null ? "accent" : score >= 75 ? "good" : score >= 55 ? "accent" : "bad";
  const restingDelta =
    baselineRestingHr !== null && day!.restingHr !== null
      ? day!.restingHr - baselineRestingHr
      : null;

  return (
    <div className="stack">
      <div className="card">
        <div className="row-between">
          <div>
            <p className="label">{stale ? `Readiness · ${formatShort(vitalsDate!)}` : "Readiness"}</p>
            <p className="card__title" style={{ marginTop: "0.3rem" }}>
              {score === null
                ? "Vitals in"
                : label === "ready"
                  ? "Green light"
                  : label === "steady"
                    ? "Steady"
                    : "Hold back"}
            </p>
            {stale && isToday ? (
              <p className="card__sub">
                Latest Watch reading — today&apos;s sleep and rest HR have not landed yet.
              </p>
            ) : advisory ? (
              <p className="card__sub">{advisory}</p>
            ) : null}
          </div>
          {score !== null ? (
            <Ring
              pct={score}
              tone={tone}
              size={72}
              thickness={7}
              value={score}
              caption="score"
              label={`Readiness ${score} of 100`}
            />
          ) : (
            <span className="row__lead row__lead--accent">
              <Icon name="watch" size={19} />
            </span>
          )}
        </div>
      </div>

      <div className="bento bento--3">
        <Link className="tile cardlink" href="/sleep" style={{ textDecoration: "none", color: "inherit" }}>
          <p className="tile__label">
            <Icon name="moon" size={13} />
            Sleep
          </p>
          <p className="tile__value">
            {day!.asleepMin !== null ? hoursMinutes(day!.asleepMin) : "—"}
          </p>
        </Link>
        <Link className="tile cardlink" href="/rest-hr" style={{ textDecoration: "none", color: "inherit" }}>
          <p className="tile__label">
            <Icon name="heart" size={13} />
            Rest HR
          </p>
          <p className="tile__value">
            {day!.restingHr ?? "—"}
            {day!.restingHr !== null ? <small>bpm</small> : null}
          </p>
          {restingDelta !== null && restingDelta !== 0 ? (
            <p className="tile__foot">
              {restingDelta > 0 ? "+" : ""}
              {restingDelta} vs normal
            </p>
          ) : null}
        </Link>
        <Link className="tile cardlink" href="/hrv" style={{ textDecoration: "none", color: "inherit" }}>
          <p className="tile__label">
            <Icon name="pulse" size={13} />
            HRV
          </p>
          <p className="tile__value">
            {day!.hrvMs !== null ? Math.round(day!.hrvMs) : "—"}
            {day!.hrvMs !== null ? <small>ms</small> : null}
          </p>
        </Link>
      </div>
    </div>
  );
}
