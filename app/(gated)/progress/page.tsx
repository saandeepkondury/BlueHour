import { AppBar } from "@/components/AppBar";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Ring } from "@/components/Ring";
import { Shell } from "@/components/Shell";
import { formatMiles } from "@/lib/format";
import { pendingCount } from "@/lib/coach/store";
import { PHASE_LABEL, type Phase } from "@/lib/plan/types";
import { getProgress } from "@/lib/progress";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const [progress, pending] = await Promise.all([getProgress(), pendingCount()]);
  const peak = progress.weeks.reduce(
    (max, week) => Math.max(max, week.plannedMi, week.loggedMi),
    1,
  );

  const { nutrition } = progress;
  const caloriePct =
    nutrition.targetCalories === 0
      ? 0
      : Math.round((nutrition.avgCalories / nutrition.targetCalories) * 100);
  const proteinPct =
    nutrition.targetProtein === 0
      ? 0
      : Math.round((nutrition.avgProtein / nutrition.targetProtein) * 100);

  return (
    <>
      <Shell>
        <AppBar title="Progress" back="/more" pending={pending} />

        <section className="block block--tight">
          <div className="card card--pad-lg">
            <div className="card__head">
              <div>
                <p className="label">Miles logged</p>
                <p className="hero__num" style={{ fontSize: "2.5rem" }}>
                  {formatMiles(progress.totalMiles)}
                  <span>mi</span>
                </p>
                <p className="card__sub">
                  {progress.runsDone} runs done · {progress.runsSkipped} skipped
                </p>
              </div>
              <Ring
                pct={progress.consistencyPct}
                tone={progress.consistencyPct >= 80 ? "good" : "accent"}
                size={72}
                thickness={7}
                value={`${progress.consistencyPct}%`}
                caption="honored"
                label={`${progress.consistencyPct} percent of days honored`}
              />
            </div>
          </div>

          <div className="bento bento--3" style={{ marginTop: "0.625rem" }}>
            <div className="tile">
              <p className="tile__label">Longest</p>
              <p className="tile__value">
                {formatMiles(progress.longestRun)}
                <small>mi</small>
              </p>
            </div>
            <div className="tile">
              <p className="tile__label">
                <Icon name="flame" size={13} />
                Streak
              </p>
              <p className="tile__value tile__value--accent">
                {progress.streak}
                <small>d</small>
              </p>
            </div>
            <div className="tile">
              <p className="tile__label">To race</p>
              <p className="tile__value">
                {progress.weeksToRace}
                <small>wk</small>
              </p>
            </div>
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">Weekly volume</h2>
            <span className="label">Logged vs planned</span>
          </div>
          <div className="card">
            <div className="cols">
              {progress.weeks.map((week) => {
                const value = week.isFuture ? week.plannedMi : week.loggedMi;
                const height = Math.max(4, Math.round((value / peak) * 100));
                return (
                  <span
                    className="col"
                    key={week.weekStart}
                    title={`${week.label} · ${PHASE_LABEL[week.phase as Phase]} · ${formatMiles(value)} mi`}
                  >
                    <span
                      className={`col__bar${week.isCurrent ? " col__bar--now" : week.isFuture ? " col__bar--future" : ""}`}
                      style={{ height: `${height}%` }}
                    />
                  </span>
                );
              })}
            </div>
            <hr className="card__divide" />
            <p className="small sub">
              {progress.daysHonored} of {progress.daysElapsed} days honored. Rest you took on purpose
              counts the same as miles.
            </p>
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">Fueling</h2>
            <span className="label">Last {nutrition.windowDays} days</span>
          </div>
          <div className="card">
            {nutrition.daysLogged === 0 ? (
              <div className="empty">
                <span className="empty__icon">
                  <Icon name="fuel" size={20} />
                </span>
                <p className="small sub">Tick off a meal on Today and this fills in.</p>
              </div>
            ) : (
              <>
                <div className="stats">
                  <div>
                    <p className="stat__value">{nutrition.avgCalories}</p>
                    <p className="stat__label">Avg kcal</p>
                  </div>
                  <div>
                    <p className="stat__value">{nutrition.avgProtein}</p>
                    <p className="stat__label">Avg protein</p>
                  </div>
                  <div>
                    <p className="stat__value">{nutrition.daysLogged}</p>
                    <p className="stat__label">Days</p>
                  </div>
                  <div>
                    <p className="stat__value">{nutrition.hydrationDays}</p>
                    <p className="stat__label">Hydrated</p>
                  </div>
                </div>
                <hr className="card__divide" />
                <div className="meter">
                  <div className="meter__head">
                    <span className="meter__name">Calories</span>
                    <span className="meter__read">{caloriePct}% of target</span>
                  </div>
                  <div className="meter__track">
                    <div className="meter__fill" style={{ width: `${Math.min(100, caloriePct)}%` }} />
                  </div>
                </div>
                <div className="meter">
                  <div className="meter__head">
                    <span className="meter__name">Protein</span>
                    <span className="meter__read">{proteinPct}% of target</span>
                  </div>
                  <div className="meter__track">
                    <div
                      className={`meter__fill${proteinPct >= 92 ? " meter__fill--good" : ""}`}
                      style={{ width: `${Math.min(100, proteinPct)}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </Shell>
      <Nav pending={pending} />
    </>
  );
}
