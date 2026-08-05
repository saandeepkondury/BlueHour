import Link from "next/link";
import type { Recovery } from "@/lib/health/read";

function hoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/**
 * Watch data, read as a single number plus the one sentence that follows from
 * it. The score never changes the plan on its own — the coach proposes, you
 * decide.
 */
export function ReadinessCard({ recovery }: { recovery: Recovery }) {
  const { day, score, label, baselineRestingHr, advisory } = recovery;

  if (!day || score === null) {
    return (
      <article className="plaque plaque--quiet">
        <p className="plaque-kicker">Readiness</p>
        <p className="plaque-note">
          No Watch data yet. <Link href="/settings/watch">Set up the Apple Health sync</Link> — one
          Shortcut on your iPhone and sleep, resting heart rate, HRV, and every run land here on
          their own.
        </p>
      </article>
    );
  }

  const tone = score >= 75 ? "good" : score >= 55 ? "ok" : "low";
  const restingDelta =
    baselineRestingHr !== null && day.restingHr !== null ? day.restingHr - baselineRestingHr : null;

  return (
    <article className={`plaque${tone === "low" ? "" : " plaque--flat"}`}>
      <p className="plaque-kicker">Readiness · last night</p>
      <div className="readiness">
        <p className={`readiness-score readiness-score--${tone}`}>{score}</p>
        <div>
          <p className="plaque-title" style={{ fontSize: "1.3rem" }}>
            {label === "ready" ? "Green light" : label === "steady" ? "Steady" : "Hold back"}
          </p>
          <p className="small muted">
            {day.asleepMin !== null ? `${hoursMinutes(day.asleepMin)} asleep` : "Sleep unknown"}
            {day.restingHr !== null ? ` · ${day.restingHr} bpm resting` : ""}
            {restingDelta !== null && restingDelta !== 0
              ? ` (${restingDelta > 0 ? "+" : ""}${restingDelta} vs normal)`
              : ""}
            {day.hrvMs !== null ? ` · HRV ${Math.round(day.hrvMs)} ms` : ""}
          </p>
        </div>
      </div>
      {advisory ? <p className="plaque-tip">{advisory}</p> : null}
    </article>
  );
}
