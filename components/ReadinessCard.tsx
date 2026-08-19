import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Ring } from "@/components/Ring";
import { formatShort, todayISO } from "@/lib/date";
import { hasReadinessSignal, hasVitals, type Recovery } from "@/lib/health/read";
import { HEALTH_SHARE_PATH } from "@/lib/health/sharing";

function hoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

function formatPace(secPerMi: number): string {
  const m = Math.floor(secPerMi / 60);
  const s = Math.round(secPerMi % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Race-feel readiness: longest run, weekly miles, run HR / pace, then today's
 * vitals. Nothing here changes the plan — the coach proposes, you decide.
 */
export function ReadinessCard({
  recovery,
  date,
}: {
  recovery: Recovery;
  /** Calendar day being viewed — keeps copy honest on past days. */
  date: string;
}) {
  const { day, score, label, baselineRestingHr, advisory, vitalsDate, lastSyncAt, racePrep } =
    recovery;
  const isToday = date === todayISO();
  const stale = Boolean(vitalsDate && vitalsDate !== date);
  const show = hasReadinessSignal(recovery);

  if (!show) {
    if (!isToday) {
      return (
        <div className="banner">
          <span className="row__lead row__lead--accent">
            <Icon name="watch" size={18} />
          </span>
          <span className="banner__body">
            <span className="banner__title">No Watch data for this day</span>
            <span className="banner__sub">
              Sleep, rest HR, and runs for {formatShort(date)} were not synced.
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
              <span className="banner__title">Waiting on today&apos;s sleep &amp; runs</span>
              <span className="banner__sub">
                Blue Hour only reads what Health sharing allows. Check Sleep (and Workouts) in{" "}
                {HEALTH_SHARE_PATH}, then sync again — or the Watch has not written yet.
              </span>
            </>
          ) : (
            <>
              <span className="banner__title">Connect your Watch</span>
              <span className="banner__sub">
                Open Blue Hour on iPhone and Allow every category on the Health sheet — especially
                Sleep. You should not need {HEALTH_SHARE_PATH} unless you turned something off.
              </span>
            </>
          )}
        </span>
        <Icon name="chevron" size={16} />
      </Link>
    );
  }

  const tone =
    score === null ? "accent" : score >= 75 ? "good" : score >= 56 ? "accent" : "bad";
  const restingDelta =
    baselineRestingHr !== null && day?.restingHr != null
      ? day.restingHr - baselineRestingHr
      : null;

  const title =
    score === null
      ? "Vitals in"
      : label === "race ready"
        ? "Race ready"
        : label === "on track"
          ? "On track"
          : "Building";

  return (
    <div className="stack">
      <Link
        href="/readiness"
        className="card cardlink"
        style={{ display: "block", color: "inherit", textDecoration: "none" }}
        aria-label="Open race readiness history"
      >
        <div className="row-between">
          <div>
            <p className="label">{stale ? `Readiness · ${formatShort(vitalsDate!)}` : "Race readiness"}</p>
            <p className="card__title" style={{ marginTop: "0.3rem" }}>
              {title}
            </p>
            {stale && isToday ? (
              <p className="card__sub">
                Latest Watch reading — today&apos;s sleep and rest HR have not landed yet. If Sleep
                stays empty, check {HEALTH_SHARE_PATH}.
              </p>
            ) : advisory ? (
              <p className="card__sub">{advisory}</p>
            ) : racePrep ? (
              <p className="card__sub">
                Longest {racePrep.longestMi || 0} mi
                {racePrep.avgRunHr ? ` · run HR ${racePrep.avgRunHr}` : ""}
                {racePrep.avgPaceSecPerMi ? ` · ${formatPace(racePrep.avgPaceSecPerMi)}/mi` : ""}
                {racePrep.daysToRace !== null ? ` · ${racePrep.daysToRace}d to race` : ""}
              </p>
            ) : null}
          </div>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            {score !== null ? (
              <Ring
                pct={score}
                tone={tone}
                size={72}
                thickness={7}
                value={score}
                caption="score"
                label={`Race readiness ${score} of 100`}
              />
            ) : (
              <span className="row__lead row__lead--accent">
                <Icon name="watch" size={19} />
              </span>
            )}
            <Icon name="chevron" size={15} />
          </span>
        </div>
      </Link>

      {hasVitals(day) ? (
        <div className="stack">
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
          {isToday && lastSyncAt && day!.asleepMin === null ? (
            <p className="small muted">
              Sleep is empty — turn it on in {HEALTH_SHARE_PATH}, or the Watch has not written
              overnight yet.
            </p>
          ) : null}
        </div>
      ) : racePrep ? (
        <div className="bento bento--3">
          <div className="tile">
            <p className="tile__label">Longest</p>
            <p className="tile__value">
              {racePrep.longestMi || "—"}
              {racePrep.longestMi > 0 ? <small>mi</small> : null}
            </p>
          </div>
          <div className="tile">
            <p className="tile__label">This week</p>
            <p className="tile__value">
              {racePrep.weekMi || "—"}
              {racePrep.weekMi > 0 ? <small>mi</small> : null}
            </p>
          </div>
          <div className="tile">
            <p className="tile__label">Run HR</p>
            <p className="tile__value">
              {racePrep.avgRunHr ?? "—"}
              {racePrep.avgRunHr !== null ? <small>bpm</small> : null}
            </p>
            {racePrep.avgPaceSecPerMi ? (
              <p className="tile__foot">{formatPace(racePrep.avgPaceSecPerMi)}/mi</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
