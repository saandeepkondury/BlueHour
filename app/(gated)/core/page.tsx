import Link from "next/link";
import { saveHealthEntry } from "@/app/actions";
import { AppBar } from "@/components/AppBar";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Ring } from "@/components/Ring";
import { Shell } from "@/components/Shell";
import { addDays, formatShort, todayISO, weekdayShort } from "@/lib/date";
import { getProfile, getWorkout } from "@/lib/store";
import { absStatus, latestMeasurement } from "@/lib/strength/abs";
import { strengthAdherence } from "@/lib/strength/log";
import { strengthBetween } from "@/lib/strength/plan";
import { pendingCount } from "@/lib/coach/store";
import type { Phase, WorkoutType } from "@/lib/plan/types";

export const dynamic = "force-dynamic";

const VERDICT: Record<string, { pill: string; label: string }> = {
  "on-track": { pill: "pill pill--good", label: "On track" },
  tight: { pill: "pill pill--warn", label: "Tight" },
  "after-race": { pill: "pill pill--accent", label: "After the race" },
  reached: { pill: "pill pill--good", label: "There" },
  "no-data": { pill: "pill", label: "Needs numbers" },
  off: { pill: "pill", label: "Off" },
};

function lb(kg: number | null): string {
  return kg === null ? "—" : String(Math.round(kg * 2.20462 * 10) / 10);
}

function inches(cm: number | null): string {
  return cm === null ? "—" : String(Math.round((cm / 2.54) * 10) / 10);
}

export default async function BodyPage() {
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
  const verdict = VERDICT[status.verdict] ?? VERDICT["no-data"];

  // How close the current reading sits to the target, not raw body fat.
  const fatPct =
    status.bodyFatPct !== null && status.bodyFatPct > 0
      ? Math.max(0, Math.min(100, (status.targetPct / status.bodyFatPct) * 100))
      : 0;

  return (
    <>
      <Shell>
        <AppBar title="Body" subtitle="Composition and core" pending={pending} />

        <section className="block block--tight">
          <div className="stack">
            <div className="card card--pad-lg">
              <div className="card__head">
                <div>
                  <span className={verdict.pill}>{verdict.label}</span>
                  <p className="hero__num" style={{ fontSize: "2.25rem" }}>
                    {status.bodyFatPct === null ? "—" : status.bodyFatPct}
                    <span>% body fat</span>
                  </p>
                  <p className="card__sub">
                    Target {status.targetPct}%
                    {status.measuredAt ? ` · measured ${formatShort(status.measuredAt)}` : ""}
                  </p>
                </div>
                <Ring
                  pct={fatPct}
                  tone={status.verdict === "tight" ? "warn" : "accent"}
                  size={72}
                  thickness={7}
                  value={status.targetPct}
                  caption="goal"
                  label={`Target ${status.targetPct} percent body fat`}
                />
              </div>

              <hr className="card__divide" />

              <div className="stats">
                <div>
                  <p className="stat__value">{lb(status.weightKg)}</p>
                  <p className="stat__label">Weight lb</p>
                </div>
                <div>
                  <p className="stat__value">{inches(latest?.waistCm ?? null)}</p>
                  <p className="stat__label">Waist in</p>
                </div>
                <div>
                  <p className="stat__value">
                    {status.kgToLose === null ? "—" : lb(status.kgToLose)}
                  </p>
                  <p className="stat__label">To go lb</p>
                </div>
                <div>
                  <p className="stat__value">{status.weeksNeeded ?? "—"}</p>
                  <p className="stat__label">Weeks</p>
                </div>
              </div>

              {status.headline ? (
                <details className="fold" style={{ marginTop: "0.5rem" }}>
                  <summary>What that means</summary>
                  <div className="fold__body">
                    <p className="small sub">{status.headline}</p>
                    {status.bodyFatSource === "waist" ? (
                      <p className="small muted" style={{ marginTop: "0.5rem" }}>
                        Estimated from waist and height. A scale reading replaces it.
                      </p>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </div>

            <div className="bento">
              <div className="tile">
                <p className="tile__label">
                  <Icon name="flame" size={13} />
                  Today
                </p>
                <p className="tile__value tile__value--accent">
                  {status.deficitKcal === 0 ? "Maint." : `−${status.deficitKcal}`}
                  {status.deficitKcal === 0 ? null : <small>kcal</small>}
                </p>
                <p className="tile__foot">below maintenance</p>
              </div>
              <div className="tile">
                <p className="tile__label">Protein floor</p>
                <p className="tile__value">
                  {status.proteinPerKg}
                  <small>g/kg</small>
                </p>
                <p className="tile__foot">
                  <Link href="/fuel">See the meals</Link>
                </p>
              </div>
            </div>

            {status.trend.weightKg !== null ||
            status.trend.waistCm !== null ||
            status.trend.bodyFatPct !== null ? (
              <div className="card">
                <p className="label" style={{ marginBottom: "0.5rem" }}>
                  Last four weeks
                </p>
                <div className="stats">
                  <div>
                    <p className="stat__value">
                      {status.trend.weightKg === null
                        ? "—"
                        : `${status.trend.weightKg > 0 ? "+" : ""}${Math.round(status.trend.weightKg * 2.20462 * 10) / 10}`}
                    </p>
                    <p className="stat__label">lb</p>
                  </div>
                  <div>
                    <p className="stat__value">
                      {status.trend.waistCm === null
                        ? "—"
                        : `${status.trend.waistCm > 0 ? "+" : ""}${Math.round((status.trend.waistCm / 2.54) * 10) / 10}`}
                    </p>
                    <p className="stat__label">in waist</p>
                  </div>
                  <div>
                    <p className="stat__value">
                      {status.trend.bodyFatPct === null
                        ? "—"
                        : `${status.trend.bodyFatPct > 0 ? "+" : ""}${status.trend.bodyFatPct}`}
                    </p>
                    <p className="stat__label">% fat</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">Log a measurement</h2>
            <span className="label">Weekly is enough</span>
          </div>
          <div className="card">
            <form action={saveHealthEntry} className="stack">
              <input type="hidden" name="date" value={today} />
              {/* step="any": a tape reads 34.75, and a rounded step silently refuses. */}
              <div className="grid3">
                <label className="field">
                  <span className="field__label">Weight lb</span>
                  <input name="weightLb" type="number" step="any" min="0" inputMode="decimal" />
                </label>
                <label className="field">
                  <span className="field__label">Waist in</span>
                  <input name="waistIn" type="number" step="any" min="0" inputMode="decimal" />
                </label>
                <label className="field">
                  <span className="field__label">Fat %</span>
                  <input
                    name="bodyFatPct"
                    type="number"
                    step="any"
                    min="3"
                    max="60"
                    inputMode="decimal"
                  />
                </label>
              </div>
              <button className="btn btn--primary btn--block" type="submit">
                Save
              </button>
            </form>
            {current.heightCm === null ? (
              <p className="card__sub" style={{ marginTop: "0.75rem" }}>
                <Link href="/settings">Add your height</Link> and a waist reading becomes a body-fat
                estimate.
              </p>
            ) : null}
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">Core &amp; strength</h2>
            <span className="pill pill--accent">Level {nextCore?.level ?? 1}</span>
          </div>

          <div className="card">
            <div className="row-between">
              <p className="label">Last four weeks</p>
              <span className="pill">
                {adherence.done}/{adherence.planned} done
              </span>
            </div>

            {upcoming.length === 0 ? (
              <div className="empty">
                <span className="empty__icon">
                  <Icon name="strength" size={20} />
                </span>
                <p className="small sub">Nothing scheduled in the next two weeks.</p>
                <Link className="btn btn--ghost btn--sm" href="/settings">
                  Set lifting days
                </Link>
              </div>
            ) : (
              <>
                <hr className="card__divide" />
                <div className="rows">
                  {upcoming.map((session) => (
                    <Link className="row" key={session.id} href={`/day/${session.date}`}>
                      <span className="row__date">{weekdayShort(session.date)}</span>
                      <span
                        className={`row__lead${session.status === "done" ? " row__lead--good" : ""}`}
                      >
                        <Icon name={session.focus === "mobility" ? "body" : "strength"} size={17} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">{session.title}</span>
                        <span className="row__sub">{formatShort(session.date)}</span>
                      </span>
                      <span className="row__meta">{session.minutes}m</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <p className="fineprint">
          Tape-measure body fat carries a few points of error. Use the direction, not the decimal.
        </p>
      </Shell>
      <Nav pending={pending} />
    </>
  );
}
