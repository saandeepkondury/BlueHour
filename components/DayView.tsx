import Link from "next/link";
import {
  addCustomFood,
  completeRestDay,
  completeWorkout,
  holdCurrentWeek,
  logWater,
  moveLongRunTo,
  removeFood,
  reopenDay,
  skipDay,
  swapMeal,
  toggleFuelStage,
  toggleMeal,
  toggleSupplement,
} from "@/app/actions";
import { CheckButton } from "@/components/CheckButton";
import { MacroBars } from "@/components/MacroBars";
import { ReadinessCard } from "@/components/ReadinessCard";
import { StrengthCard } from "@/components/StrengthCard";
import { dayOfWeek, formatLong, startOfWeek, weekdayShort } from "@/lib/date";
import { formatDuration, formatMiles, formatPace } from "@/lib/format";
import { candidatesFor, parseAllergies, SLOT_LABEL, type Diet, type Slot } from "@/lib/nutrition/recipes";
import { EVIDENCE_LABEL } from "@/lib/nutrition/supplements";
import { PHASE_LABEL, TYPE_LABEL, isRun, type Phase, type WorkoutType } from "@/lib/plan/types";
import type { DayBundle } from "@/lib/store";

const FEELINGS = ["strong", "steady", "flat", "rough"];
const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function DayView({
  bundle,
  isToday,
  longRunOptions,
}: {
  bundle: DayBundle;
  isToday: boolean;
  longRunOptions: { date: string; title: string }[];
}) {
  const { date, workout, workoutLog, targets, meals, extras, consumed, dayLog, profile } = bundle;
  const type = workout.type as WorkoutType;
  const phase = workout.phase as Phase;
  const runDay = isRun(type);
  const allergies = parseAllergies(profile.allergies);
  const diet = profile.dietPref as Diet;
  const weekStart = startOfWeek(date);

  return (
    <>
      <section className="sec">
        <p className="sec-label">{isToday ? "Today" : weekdayShort(date)}</p>

        <ReadinessCard recovery={bundle.recovery} />

        <article className="plaque">
          <p className="plaque-kicker">
            {PHASE_LABEL[phase]} · {TYPE_LABEL[type]}
            {workout.status === "done" ? " · done" : workout.status === "skipped" ? " · skipped" : ""}
          </p>
          <h2 className="plaque-title">
            {type === "race" ? (
              <>
                Austin Half Marathon — <em>13.1 mi</em>
              </>
            ) : (
              workout.title
            )}
          </h2>
          {!isToday ? <p className="tiny muted">{formatLong(date)}</p> : null}
          <p className="plaque-note">{workout.purpose}</p>
          {workout.tip ? <p className="plaque-tip">{workout.tip}</p> : null}

          {workout.status === "done" && workoutLog ? (
            <div className="metric-row">
              <div className="metric">
                <p className="metric-value">{formatMiles(workoutLog.distanceMi)}</p>
                <p className="metric-label">Miles</p>
              </div>
              <div className="metric">
                <p className="metric-value">{formatDuration(workoutLog.durationSec)}</p>
                <p className="metric-label">Time</p>
              </div>
              <div className="metric">
                <p className="metric-value">{formatPace(workoutLog.durationSec, workoutLog.distanceMi)}</p>
                <p className="metric-label">Pace</p>
              </div>
              {workoutLog.feel ? (
                <div className="metric">
                  <p className="metric-value" style={{ fontStyle: "italic" }}>
                    {workoutLog.feel}
                  </p>
                  <p className="metric-label">Felt</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {workoutLog?.notes ? <p className="plaque-tip">{workoutLog.notes}</p> : null}

          {workout.status === "skipped" ? (
            <p className="plaque-note">
              Skipped{workout.skipReason ? ` — ${workout.skipReason}` : ""}. The plan does not stack
              it onto next week.
            </p>
          ) : null}

          {workout.status === "planned" && !runDay ? (
            <form action={completeRestDay} className="btn-row">
              <input type="hidden" name="date" value={date} />
              <button className="btn" type="submit">
                Rest honored
              </button>
            </form>
          ) : null}

          {workout.status !== "planned" ? (
            <form action={reopenDay} className="btn-row">
              <input type="hidden" name="date" value={date} />
              <button className="btn btn--ghost btn--small" type="submit">
                Reopen this day
              </button>
            </form>
          ) : null}
        </article>

        {workout.status === "planned" && runDay ? (
          <article className="plaque plaque--flat">
            <p className="plaque-kicker">Log the run</p>
            <form action={completeWorkout}>
              <input type="hidden" name="date" value={date} />
              <div className="field-row">
                <label className="field">
                  <span className="field-label">Miles</span>
                  <input
                    name="distanceMi"
                    type="number"
                    step="any"
                    min="0"
                    defaultValue={workout.distanceMi || ""}
                    inputMode="decimal"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Minutes</span>
                  <input name="minutes" type="number" min="0" inputMode="numeric" placeholder={
                    workout.durationMin ? String(workout.durationMin) : ""
                  } />
                </label>
                <label className="field">
                  <span className="field-label">Seconds</span>
                  <input name="seconds" type="number" min="0" max="59" inputMode="numeric" />
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <span className="field-label">Felt</span>
                  <select name="feel" defaultValue="steady">
                    {FEELINGS.map((feel) => (
                      <option key={feel} value={feel}>
                        {feel}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Effort 1–10</span>
                  <input name="rpe" type="number" min="1" max="10" inputMode="numeric" />
                </label>
              </div>
              <label className="field">
                <span className="field-label">Notes</span>
                <textarea name="notes" placeholder="Shoes, weather, where it hurt, what worked." />
              </label>
              <button className="btn btn--full" type="submit">
                Mark complete
              </button>
            </form>

            <details style={{ marginTop: "1.2rem" }}>
              <summary className="plaque-kicker" style={{ cursor: "pointer" }}>
                Could not run today
              </summary>
              <form action={skipDay} style={{ marginTop: "0.8rem" }}>
                <input type="hidden" name="date" value={date} />
                <label className="field">
                  <span className="field-label">What got in the way</span>
                  <input name="reason" placeholder="Travel, sore shin, work, heat" />
                </label>
                <button className="btn btn--ghost btn--small" type="submit">
                  Skip without guilt
                </button>
              </form>
            </details>
          </article>
        ) : null}

        {isToday && (longRunOptions.length > 0 || phase !== "race") ? (
          <article className="plaque plaque--quiet">
            <p className="plaque-kicker">This week, if life happens</p>
            <div className="btn-row">
              <form action={holdCurrentWeek}>
                <input type="hidden" name="weekStart" value={weekStart} />
                <button className="btn btn--ghost btn--small" type="submit">
                  Hold this week
                </button>
              </form>
            </div>
            <p className="tiny muted" style={{ marginTop: "0.5rem" }}>
              Holding repeats this week&apos;s mileage instead of progressing. Nothing is lost.
            </p>

            {longRunOptions.length > 0 ? (
              <form action={moveLongRunTo} style={{ marginTop: "1rem" }}>
                <input type="hidden" name="weekStart" value={weekStart} />
                <label className="field">
                  <span className="field-label">Move the long run to</span>
                  <select name="dow" defaultValue={String(dayOfWeek(longRunOptions[0].date))}>
                    {longRunOptions.map((option) => (
                      <option key={option.date} value={dayOfWeek(option.date)}>
                        {DOW_NAMES[dayOfWeek(option.date)]}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn btn--ghost btn--small" type="submit">
                  Swap days
                </button>
              </form>
            ) : null}
          </article>
        ) : null}
      </section>

      {bundle.strength ? (
        <section className="sec">
          <p className="sec-label">Strength &amp; core</p>
          <h2 className="sec-title">
            {bundle.strength.focus === "core" ? (
              <>
                Ten minutes for the <em>abs</em>
              </>
            ) : bundle.strength.focus === "mobility" ? (
              <>
                Keep it <em>loose</em>
              </>
            ) : (
              <>
                Lift so the miles <em>hold</em>
              </>
            )}
          </h2>
          <StrengthCard
            session={bundle.strength}
            done={bundle.strengthDone}
            log={bundle.strengthLog}
          />
        </section>
      ) : null}

      {bundle.fuel.length > 0 ? (
        <section className="sec">
          <p className="sec-label">Long-run fuel</p>
          <h2 className="sec-title">
            Fuel the <em>distance</em>
          </h2>
          <article className="plaque">
            <ul className="check-list">
              {bundle.fuel.map((stage) => {
                const done = bundle.fuelDone.has(stage.stage);
                return (
                  <li
                    className={done ? "check-item check-item--done" : "check-item"}
                    key={stage.stage}
                  >
                    <CheckButton
                      action={toggleFuelStage}
                      checked={done}
                      label={stage.label}
                      fields={{ date, stage: stage.stage, checked: done ? "0" : "1" }}
                    />
                    <div className="check-body">
                      <p className="check-slot">{stage.timing}</p>
                      <p className="check-name">{stage.label}</p>
                      <p className="check-macros">{stage.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        </section>
      ) : null}

      <section className="sec">
        <p className="sec-label">Fuel</p>
        <h2 className="sec-title">
          Eat for <em>{TYPE_LABEL[type].toLowerCase()}</em>
        </h2>
        <p className="sec-intro">{targets.headline}</p>

        <article className="plaque">
          <p className="plaque-kicker">Today&apos;s targets</p>
          {profile.absGoal === 1 ? <p className="tiny muted">{bundle.fuelNote}</p> : null}
          <MacroBars
            rows={[
              { label: "Calories", value: consumed.calories, target: targets.calories, unit: "kcal" },
              { label: "Protein", value: consumed.protein, target: targets.protein, unit: "g" },
              { label: "Carbs", value: consumed.carbs, target: targets.carbs, unit: "g" },
              { label: "Fat", value: consumed.fat, target: targets.fat, unit: "g" },
            ]}
          />
          {targets.estimated ? (
            <p className="plaque-tip">
              These numbers assume an average build. <Link href="/settings">Add your stats</Link> to
              make them yours.
            </p>
          ) : null}
        </article>

        <article className="plaque">
          <p className="plaque-kicker">Meals</p>
          <ul className="check-list">
            {meals.map((meal) => {
              const eaten = meal.eaten === 1;
              const options = candidatesFor(meal.slot as Slot, diet, allergies);
              return (
                <li className={eaten ? "check-item check-item--done" : "check-item"} key={meal.id}>
                  <CheckButton
                    action={toggleMeal}
                    checked={eaten}
                    label={meal.name}
                    fields={{ date, slot: meal.slot, eaten: eaten ? "0" : "1" }}
                  />
                  <div className="check-body">
                    <p className="check-slot">{SLOT_LABEL[meal.slot as Slot]}</p>
                    <p className="check-name">
                      {meal.recipeId ? (
                        <Link href={`/recipe/${meal.recipeId}`}>{meal.name}</Link>
                      ) : (
                        meal.name
                      )}
                    </p>
                    <p className="check-macros">
                      {meal.calories} kcal · {meal.protein}p / {meal.carbs}c / {meal.fat}f
                    </p>
                    {options.length > 1 ? (
                      <details style={{ marginTop: "0.4rem" }}>
                        <summary className="tiny muted" style={{ cursor: "pointer" }}>
                          Swap
                        </summary>
                        <form action={swapMeal} style={{ marginTop: "0.5rem" }}>
                          <input type="hidden" name="date" value={date} />
                          <input type="hidden" name="slot" value={meal.slot} />
                          <select name="recipeId" defaultValue={meal.recipeId ?? options[0].id}>
                            {options.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name} · {option.calories} kcal
                              </option>
                            ))}
                          </select>
                          <button className="btn btn--ghost btn--small" type="submit" style={{ marginTop: "0.5rem" }}>
                            Use this instead
                          </button>
                        </form>
                      </details>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </article>

        {extras.length > 0 ? (
          <article className="plaque plaque--flat">
            <p className="plaque-kicker">Also eaten</p>
            <ul className="check-list">
              {extras.map((extra) => (
                <li className="check-item" key={extra.id}>
                  <div className="check-body">
                    <p className="check-name">{extra.name}</p>
                    <p className="check-macros">
                      {extra.calories} kcal · {extra.protein}p / {extra.carbs}c / {extra.fat}f
                    </p>
                  </div>
                  <form action={removeFood}>
                    <input type="hidden" name="id" value={extra.id} />
                    <input type="hidden" name="date" value={date} />
                    <button className="btn btn--ghost btn--small" type="submit">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </article>
        ) : null}

        <article className="plaque plaque--flat">
          <p className="plaque-kicker">Quick add</p>
          <form action={addCustomFood}>
            <input type="hidden" name="date" value={date} />
            <label className="field">
              <span className="field-label">What you ate</span>
              <input name="name" placeholder="Taco from Veracruz" required />
            </label>
            <div className="field-row">
              <label className="field">
                <span className="field-label">kcal</span>
                <input name="calories" type="number" min="0" inputMode="numeric" />
              </label>
              <label className="field">
                <span className="field-label">Protein</span>
                <input name="protein" type="number" min="0" inputMode="numeric" />
              </label>
              <label className="field">
                <span className="field-label">Carbs</span>
                <input name="carbs" type="number" min="0" inputMode="numeric" />
              </label>
              <label className="field">
                <span className="field-label">Fat</span>
                <input name="fat" type="number" min="0" inputMode="numeric" />
              </label>
            </div>
            <button className="btn btn--ghost btn--small" type="submit">
              Add to today
            </button>
          </form>
        </article>

        <article className="plaque">
          <p className="plaque-kicker">Water</p>
          <div className="split">
            <p className="stepper-value">
              {dayLog.waterOz}
              <small>of {targets.waterOz} oz</small>
            </p>
          </div>
          <div className="btn-row">
            {[8, 16, 24].map((oz) => (
              <form action={logWater} key={oz}>
                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="oz" value={oz} />
                <button className="btn btn--ghost btn--small" type="submit">
                  +{oz} oz
                </button>
              </form>
            ))}
            <form action={logWater}>
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="oz" value={-8} />
              <button className="btn btn--ghost btn--small" type="submit">
                −8 oz
              </button>
            </form>
          </div>
          {targets.sodiumMg ? (
            <p className="plaque-tip">
              Aim for roughly {targets.sodiumMg} mg sodium across the day — Austin humidity takes more
              than you think.
            </p>
          ) : null}
        </article>
      </section>

      {bundle.supplements.length > 0 ? (
        <section className="sec">
          <p className="sec-label">Supplements</p>
          <h2 className="sec-title">
            Only what <em>earns</em> its place
          </h2>
          <article className="plaque">
            <ul className="check-list">
              {bundle.supplements.map((supplement) => {
                const taken = bundle.supplementsTaken.has(supplement.id);
                return (
                  <li
                    className={taken ? "check-item check-item--done" : "check-item"}
                    key={supplement.id}
                  >
                    <CheckButton
                      action={toggleSupplement}
                      checked={taken}
                      label={supplement.name}
                      fields={{ date, id: supplement.id, taken: taken ? "0" : "1" }}
                    />
                    <div className="check-body">
                      <p className="check-slot">{supplement.timing}</p>
                      <p className="check-name">
                        {supplement.name} <span className="pill">{supplement.dose}</span>
                      </p>
                      <p className="check-macros">{supplement.purpose}</p>
                      <p className="tiny muted">{EVIDENCE_LABEL[supplement.evidence]}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="disclaimer">
              General guidance for a healthy adult training for a half marathon — not medical advice.
              Anything ongoing, ask a doctor or a sports dietitian.
            </p>
          </article>
        </section>
      ) : null}
    </>
  );
}
