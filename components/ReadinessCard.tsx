import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Ring } from "@/components/Ring";
import type { Recovery } from "@/lib/health/read";

function hoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/**
 * Watch data as four glanceable tiles led by one score. Nothing here changes
 * the plan — the coach proposes, you decide.
 */
export function ReadinessCard({ recovery }: { recovery: Recovery }) {
  const { day, score, label, baselineRestingHr, advisory } = recovery;

  if (!day || score === null) {
    return (
      <Link className="banner cardlink" href="/settings/watch">
        <span className="row__lead row__lead--accent">
          <Icon name="watch" size={18} />
        </span>
        <span className="banner__body">
          <span className="banner__title">Connect your Watch</span>
          <span className="banner__sub">Sleep, HRV and runs land here on their own.</span>
        </span>
        <Icon name="chevron" size={16} />
      </Link>
    );
  }

  const tone = score >= 75 ? "good" : score >= 55 ? "accent" : "bad";
  const restingDelta =
    baselineRestingHr !== null && day.restingHr !== null ? day.restingHr - baselineRestingHr : null;

  return (
    <div className="stack">
      <div className="card">
        <div className="row-between">
          <div>
            <p className="label">Readiness</p>
            <p className="card__title" style={{ marginTop: "0.3rem" }}>
              {label === "ready" ? "Green light" : label === "steady" ? "Steady" : "Hold back"}
            </p>
            {advisory ? <p className="card__sub">{advisory}</p> : null}
          </div>
          <Ring
            pct={score}
            tone={tone}
            size={72}
            thickness={7}
            value={score}
            caption="score"
            label={`Readiness ${score} of 100`}
          />
        </div>
      </div>

      <div className="bento bento--3">
        <div className="tile tile--sunk">
          <p className="tile__label">
            <Icon name="moon" size={13} />
            Sleep
          </p>
          <p className="tile__value">
            {day.asleepMin !== null ? hoursMinutes(day.asleepMin) : "—"}
          </p>
        </div>
        <div className="tile tile--sunk">
          <p className="tile__label">
            <Icon name="heart" size={13} />
            Rest HR
          </p>
          <p className="tile__value">
            {day.restingHr ?? "—"}
            {day.restingHr !== null ? <small>bpm</small> : null}
          </p>
          {restingDelta !== null && restingDelta !== 0 ? (
            <p className="tile__foot">
              {restingDelta > 0 ? "+" : ""}
              {restingDelta} vs normal
            </p>
          ) : null}
        </div>
        <div className="tile tile--sunk">
          <p className="tile__label">
            <Icon name="pulse" size={13} />
            HRV
          </p>
          <p className="tile__value">
            {day.hrvMs !== null ? Math.round(day.hrvMs) : "—"}
            {day.hrvMs !== null ? <small>ms</small> : null}
          </p>
        </div>
      </div>
    </div>
  );
}
