import Link from "next/link";
import { saveHealthEntry } from "@/app/actions";
import { Nav } from "@/components/Nav";
import { addDays, formatLong, formatShort, todayISO, weekdayShort } from "@/lib/date";
import { getWorkout } from "@/lib/store";
import { getProfile } from "@/lib/store";
import { absStatus, latestMeasurement } from "@/lib/strength/abs";
import { strengthAdherence } from "@/lib/strength/log";
import { strengthBetween } from "@/lib/strength/plan";
import { pendingCount } from "@/lib/coach/store";
import { parseBlocks } from "@/lib/strength/exercises";
import type { Phase, WorkoutType } from "@/lib/plan/types";

export const dynamic = "force-dynamic";

const VERDICT_PILL: Record<string, string> = {
  "on-track": "pill pill--oak",
  tight: "pill pill--accent",
  "after-race": "pill pill--clay",
  reached: "pill pill--oak",
  "no-data": "pill",
  off: "pill",
};

const VERDICT_LABEL: Record<string, string> = {
  "on-track": "On track",
  tight: "Tight",
  "after-race": "After the race",
  reached: "There",
  "no-data": "Needs numbers",
  off: "Off",
};

function lb(kg: number | null): string {
  return kg === null ? "—" : `${Math.round(kg * 2.20462 * 10) / 10} lb`;
}

function inches(cm: number | null): string {
  return cm === null ? "—" : `${Math.round((cm / 2.54) * 10) / 10} in`;
}

export default async function CorePage() {
  const today = todayISO();
  const current = await getProfile();
  const workout = await getWorkout(today);

  const [status, latest, upcoming, adherence, pending] = await Promise.all([
    absStatus(current, today, {
      phase: (workout?.phase ?? "base") as Phase,
      type: (workout?.type ?? "rest") as WorkoutType,
    }),
    latestMeasurement(today),
    strengthBetween(today, addDays(today, 13)),
    strengthAdherence(addDays(today, -27), today),
    pendingCount(),
  ]);

  const nextCore = upcoming.find((session) => session.focus === "core");
  const coreLevel = nextCore?.level ?? null;

  return (
    <>
      <main className="shell">
        <section className="sec">
          <p className="sec-label">Second goal</p>
          <h1 className="sec-title">
            Visible <em>abs</em>, without losing the race
          </h1>
          <p className="sec-intro">
            Abs are two problems wearing one name: the muscle, which the core circuits build, and
            the body fat over it, which only the kitchen moves. This page keeps both honest against
            a half marathon that needs feeding.
          </p>

          <article className="plaque">
            <p className="plaque-kicker">
              Where you are{" "}
              <span className={VERDICT_PILL[status.verdict] ?? "pill"}>
                {VERDICT_LABEL[status.verdict] ?? status.verdict}
              </span>
            </p>
            <div className="metric-row">
              <div className="metric">
                <p className="metric-value metric-value--accent">
                  {status.bodyFatPct === null ? "—" : `${status.bodyFatPct}%`}
                </p>
                <p className="metric-label">Body fat</p>
              </div>
              <div className="metric">
                <p className="metric-value">{status.targetPct}%</p>
                <p className="metric-label">Target</p>
              </div>
              <div className="metric">
                <p className="metric-value">{lb(status.weightKg)}</p>
                <p className="metric-label">Weight</p>
              </div>
              <div className="metric">
                <p className="metric-value">{inches(latest?.waistCm ?? null)}</p>
                <p className="metric-label">Waist</p>
              </div>
            </div>
            <p className="plaque-note">{status.headline}</p>
            {status.bodyFatSource === "waist" ? (
              <p className="tiny muted">
                Estimated from your waist and height. A scale reading, if you have one, replaces it.
              </p>
            ) : null}
            {status.measuredAt ? (
              <p className="plaque-tip">Last measured {formatShort(status.measuredAt)}.</p>
            ) : null}
          </article>

          <article className="plaque plaque--flat">
            <p className="plaque-kicker">Today&apos;s calorie stance</p>
            <p className="plaque-title" style={{ fontSize: "1.4rem" }}>
              {status.deficitKcal === 0
                ? "Maintenance"
                : `${status.deficitKcal} kcal below maintenance`}
            </p>
            <p className="plaque-note">{status.deficitNote}</p>
            <p className="plaque-tip">
              Protein target is {status.proteinPerKg} g per kg today — the one number that decides
              whether a deficit costs fat or muscle. <Link href="/fuel">See the meals</Link>.
            </p>
          </article>

          {status.trend.weightKg !== null || status.trend.waistCm !== null ? (
            <article className="plaque plaque--flat">
              <p className="plaque-kicker">Last four weeks</p>
              <div className="metric-row">
                {status.trend.weightKg !== null ? (
                  <div className="metric">
                    <p className="metric-value">
                      {status.trend.weightKg > 0 ? "+" : ""}
                      {Math.round(status.trend.weightKg * 2.20462 * 10) / 10}
                    </p>
                    <p className="metric-label">lb</p>
                  </div>
                ) : null}
                {status.trend.waistCm !== null ? (
                  <div className="metric">
                    <p className="metric-value">
                      {status.trend.waistCm > 0 ? "+" : ""}
                      {Math.round((status.trend.waistCm / 2.54) * 10) / 10}
                    </p>
                    <p className="metric-label">in waist</p>
                  </div>
                ) : null}
                {status.trend.bodyFatPct !== null ? (
                  <div className="metric">
                    <p className="metric-value">
                      {status.trend.bodyFatPct > 0 ? "+" : ""}
                      {status.trend.bodyFatPct}
                    </p>
                    <p className="metric-label">% fat</p>
                  </div>
                ) : null}
              </div>
            </article>
          ) : null}
        </section>

        <section className="sec">
          <p className="sec-label">Measure</p>
          <h2 className="sec-title">
            One tape, once a <em>week</em>
          </h2>
          <p className="sec-intro">
            Waist at the navel, first thing in the morning, before you eat. Weight the same way. Two
            numbers a week beat daily numbers you start ignoring.
          </p>
          <article className="plaque">
            <form action={saveHealthEntry}>
              <input type="hidden" name="date" value={today} />
              <div className="field-row">
                {/* step="any": a tape reads 34.75, and a rounded step silently
                    refuses to submit rather than saying why. */}
                <label className="field">
                  <span className="field-label">Weight (lb)</span>
                  <input name="weightLb" type="number" step="any" min="0" inputMode="decimal" />
                </label>
                <label className="field">
                  <span className="field-label">Waist (in)</span>
                  <input name="waistIn" type="number" step="any" min="0" inputMode="decimal" />
                </label>
                <label className="field">
                  <span className="field-label">Body fat %</span>
                  <input name="bodyFatPct" type="number" step="any" min="3" max="60" inputMode="decimal" />
                </label>
              </div>
              <button className="btn" type="submit">
                Save today&apos;s numbers
              </button>
            </form>
            {current.heightCm === null ? (
              <p className="plaque-tip">
                Add your height in <Link href="/settings">Settings</Link> and a waist measurement
                becomes a body-fat estimate.
              </p>
            ) : null}
          </article>
        </section>

        <section className="sec">
          <p className="sec-label">Core work</p>
          <h2 className="sec-title">
            Level {coreLevel ?? 1} <em>progression</em>
          </h2>
          <p className="sec-intro">
            {adherence.planned > 0
              ? `${adherence.done} of ${adherence.planned} sessions done in the last four weeks.`
              : "Sessions appear here as the block gets going."}{" "}
            The circuits climb through four levels — planks and dead bugs first, hanging leg raises
            and loaded crunches by the end.
          </p>

          {upcoming.length === 0 ? (
            <article className="plaque plaque--quiet">
              <p className="plaque-note">
                No strength sessions scheduled in the next two weeks. Check the number of lifting
                days in <Link href="/settings">Settings</Link>.
              </p>
            </article>
          ) : (
            upcoming.map((session) => {
              const blocks = parseBlocks(session.blocks);
              const core = blocks.find((block) => block.name.startsWith("Core"));
              return (
                <Link className="day" key={session.id} href={`/day/${session.date}`}>
                  <span className="day-date">{weekdayShort(session.date)}</span>
                  <span className="day-name">
                    {session.title}
                    {core ? (
                      <span className="block-cue">
                        {core.exercises.map((exercise) => exercise.name).join(" · ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="day-dist">{session.minutes} min</span>
                  {session.status !== "planned" ? (
                    <span className="day-flag">{session.status}</span>
                  ) : null}
                </Link>
              );
            })
          )}
        </section>

        <p className="disclaimer">
          Body-fat estimates from a tape measure carry a few points of error either way — use the
          direction of travel, not the decimal. Race day is {formatLong(current.raceDate)}.
        </p>
      </main>
      <Nav pending={pending} />
    </>
  );
}
