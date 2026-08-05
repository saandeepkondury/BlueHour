import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { formatMiles } from "@/lib/format";
import { PHASE_LABEL, type Phase } from "@/lib/plan/types";
import { getProgress } from "@/lib/progress";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const progress = await getProgress();
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
    <Shell wide>
      <section className="sec">
        <p className="sec-label">IV · Progress</p>
        <h2 className="sec-title">
          What you have <em>actually done</em>
        </h2>
        <p className="sec-intro">
          Rest days you honored count the same as miles. Skipped runs are recorded, not punished.
        </p>

        <article className="plaque">
          <div className="metric-row">
            <div className="metric">
              <p className="metric-value">{formatMiles(progress.totalMiles)}</p>
              <p className="metric-label">Miles logged</p>
            </div>
            <div className="metric">
              <p className="metric-value">{formatMiles(progress.longestRun)}</p>
              <p className="metric-label">Longest run</p>
            </div>
            <div className="metric">
              <p className="metric-value">{progress.consistencyPct}%</p>
              <p className="metric-label">Days honored</p>
            </div>
            <div className="metric">
              <p className="metric-value">{progress.streak}</p>
              <p className="metric-label">Day streak</p>
            </div>
            <div className="metric">
              <p className="metric-value">{progress.weeksToRace}</p>
              <p className="metric-label">Weeks to go</p>
            </div>
          </div>
          <p className="plaque-tip">
            {progress.runsDone} runs completed · {progress.runsSkipped} skipped ·{" "}
            {progress.daysHonored} of {progress.daysElapsed} days honored so far.
          </p>
        </article>
      </section>

      <section className="sec">
        <p className="sec-label">Weekly volume</p>
        <article className="plaque">
          <div className="bars">
            {progress.weeks.map((week) => {
              const plannedPct = Math.round((week.plannedMi / peak) * 100);
              const loggedPct = Math.round((week.loggedMi / peak) * 100);
              return (
                <div className="bar-row" key={week.weekStart}>
                  <div className="bar-head">
                    <strong>
                      {week.label}
                      {week.isCurrent ? " · now" : ""}
                    </strong>
                    <span>
                      {week.isFuture
                        ? `${formatMiles(week.plannedMi)} mi planned`
                        : `${formatMiles(week.loggedMi)} of ${formatMiles(week.plannedMi)} mi`}
                    </span>
                  </div>
                  <div
                    className="bar-track"
                    title={`${PHASE_LABEL[week.phase as Phase]} · ${week.range}`}
                  >
                    <div
                      className="bar-fill"
                      style={{
                        width: `${week.isFuture ? plannedPct : loggedPct}%`,
                        opacity: week.isFuture ? 0.35 : 1,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="sec">
        <p className="sec-label">Fueling, last {nutrition.windowDays} days</p>
        <article className="plaque">
          {nutrition.daysLogged === 0 ? (
            <p className="muted">
              Nothing logged yet this week. Tick off a meal on Today and this fills in.
            </p>
          ) : (
            <>
              <div className="metric-row">
                <div className="metric">
                  <p className="metric-value">{nutrition.avgCalories}</p>
                  <p className="metric-label">Avg kcal</p>
                </div>
                <div className="metric">
                  <p className="metric-value">{nutrition.avgProtein}g</p>
                  <p className="metric-label">Avg protein</p>
                </div>
                <div className="metric">
                  <p className="metric-value">{nutrition.daysLogged}</p>
                  <p className="metric-label">Days logged</p>
                </div>
                <div className="metric">
                  <p className="metric-value">{nutrition.hydrationDays}</p>
                  <p className="metric-label">Hydrated days</p>
                </div>
              </div>
              <p className="plaque-tip">
                Calories tracking at {caloriePct}% of target, protein at {proteinPct}%. Protein is the
                one worth chasing — it is what turns training into adaptation.
              </p>
            </>
          )}
        </article>
      </section>

      <Nav />
    </Shell>
  );
}
