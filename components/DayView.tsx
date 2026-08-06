import Link from "next/link";
import {
  addCustomFood,
  holdCurrentWeek,
  logWater,
  moveLongRunTo,
  removeFood,
  swapMeal,
  toggleFuelStage,
  toggleMeal,
  toggleSupplement,
} from "@/app/actions";
import { Check } from "@/components/Check";
import { Icon } from "@/components/Icon";
import { MacroBars } from "@/components/MacroBars";
import { ReadinessCard } from "@/components/ReadinessCard";
import { Ring } from "@/components/Ring";
import { SessionCard } from "@/components/SessionCard";
import { StrengthCard } from "@/components/StrengthCard";
import { WaterCard } from "@/components/WaterCard";
import { dayOfWeek, startOfWeek } from "@/lib/date";
import {
  candidatesFor,
  parseAllergies,
  SLOT_LABEL,
  type Diet,
  type Slot,
} from "@/lib/nutrition/recipes";
import { isRun, type Phase, type WorkoutType } from "@/lib/plan/types";
import type { DayBundle } from "@/lib/store";

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
  const allergies = parseAllergies(profile.allergies);
  const diet = profile.dietPref as Diet;
  const weekStart = startOfWeek(date);
  const caloriePct = targets.calories > 0 ? (consumed.calories / targets.calories) * 100 : 0;
  const mealsEaten = meals.filter((meal) => meal.eaten === 1).length;

  return (
    <>
      <section className="block">
        <div className="stack">
          <ReadinessCard recovery={bundle.recovery} date={date} />
          <SessionCard workout={workout} log={workoutLog} hasStrength={bundle.strength !== null} />
        </div>

        {isToday && (longRunOptions.length > 0 || isRun(type)) && phase !== "race" ? (
          <details className="fold" style={{ marginTop: "0.75rem" }}>
            <summary>Adjust this week</summary>
            <div className="fold__body">
              <div className="card card--sunk stack">
                <form action={holdCurrentWeek}>
                  <input type="hidden" name="weekStart" value={weekStart} />
                  <button className="btn btn--ghost btn--sm btn--block" type="submit">
                    Repeat this week&apos;s mileage
                  </button>
                </form>

                {longRunOptions.length > 0 ? (
                  <form action={moveLongRunTo}>
                    <input type="hidden" name="weekStart" value={weekStart} />
                    <p className="field__label">Move the long run to</p>
                    <div className="inline-field">
                      <select name="dow" defaultValue={String(dayOfWeek(longRunOptions[0].date))}>
                        {longRunOptions.map((option) => (
                          <option key={option.date} value={dayOfWeek(option.date)}>
                            {DOW_NAMES[dayOfWeek(option.date)]}
                          </option>
                        ))}
                      </select>
                      <button className="btn btn--quiet btn--sm nowrap" type="submit">
                        Move
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            </div>
          </details>
        ) : null}
      </section>

      {bundle.strength ? (
        <section className="block">
          <div className="block__head">
            <h2 className="block__title">Strength &amp; core</h2>
            <Link className="block__link" href="/core">
              Progression
            </Link>
          </div>
          <StrengthCard
            session={bundle.strength}
            done={bundle.strengthDone}
            log={bundle.strengthLog}
          />
        </section>
      ) : null}

      {bundle.fuel.length > 0 ? (
        <section className="block">
          <div className="block__head">
            <h2 className="block__title">Long-run fuel</h2>
            <span className="pill">
              {bundle.fuelDone.size}/{bundle.fuel.length}
            </span>
          </div>
          <div className="card">
            <div className="rows">
              {bundle.fuel.map((stage) => {
                const stageDone = bundle.fuelDone.has(stage.stage);
                return (
                  <div className={stageDone ? "row row--done" : "row"} key={stage.stage}>
                    <Check
                      action={toggleFuelStage}
                      on={stageDone}
                      flag="checked"
                      label={stage.label}
                      fields={{ date, stage: stage.stage }}
                    />
                    <div className="row__body">
                      <span className="row__title">{stage.label}</span>
                      <span className="row__sub">{stage.timing}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="block">
        <div className="block__head">
          <h2 className="block__title">Fuel</h2>
          <Link className="block__link" href="/fuel">
            Week
          </Link>
        </div>

        <div className="stack">
          <div className="card">
            <div className="row-between">
              <div>
                <p className="tile__label">
                  <Icon name="flame" size={13} />
                  Calories
                </p>
                <p className="tile__value" style={{ marginTop: "0.3rem" }}>
                  {Math.round(consumed.calories)}
                  <small>/ {targets.calories}</small>
                </p>
              </div>
              <Ring
                pct={caloriePct}
                tone={caloriePct > 108 ? "warn" : "accent"}
                size={64}
                thickness={6}
                value={`${Math.min(999, Math.round(caloriePct))}%`}
                label={`${Math.round(consumed.calories)} of ${targets.calories} calories`}
              />
            </div>
            <hr className="card__divide" />
            <MacroBars
              rows={[
                { label: "Protein", value: consumed.protein, target: targets.protein, unit: "g" },
                { label: "Carbs", value: consumed.carbs, target: targets.carbs, unit: "g" },
                { label: "Fat", value: consumed.fat, target: targets.fat, unit: "g" },
              ]}
            />
            {targets.estimated ? (
              <p className="card__sub" style={{ marginTop: "0.75rem" }}>
                Estimated from an average build. <Link href="/settings">Add your stats</Link>.
              </p>
            ) : null}
          </div>

          <div className="card">
            <div className="row-between" style={{ marginBottom: "0.25rem" }}>
              <p className="label">Meals</p>
              <span className="pill">
                {mealsEaten}/{meals.length}
              </span>
            </div>
            <div className="rows">
              {meals.map((meal) => {
                const eaten = meal.eaten === 1;
                const options = candidatesFor(meal.slot as Slot, diet, allergies);
                return (
                  <div className={eaten ? "row row--done" : "row"} key={meal.id}>
                    <Check
                      action={toggleMeal}
                      on={eaten}
                      flag="eaten"
                      label={meal.name}
                      fields={{ date, slot: meal.slot }}
                    />
                    <div className="row__body">
                      <span className="row__title">
                        {meal.recipeId ? (
                          <Link href={`/recipe/${meal.recipeId}`} style={{ color: "inherit" }}>
                            {meal.name}
                          </Link>
                        ) : (
                          meal.name
                        )}
                      </span>
                      <span className="row__sub">
                        {SLOT_LABEL[meal.slot as Slot]} · {meal.protein}p / {meal.carbs}c /{" "}
                        {meal.fat}f
                      </span>
                      {options.length > 1 ? (
                        <details className="fold">
                          <summary style={{ minHeight: "1.75rem", fontSize: "0.75rem" }}>
                            Swap
                          </summary>
                          <div className="fold__body">
                            <form action={swapMeal}>
                              <input type="hidden" name="date" value={date} />
                              <input type="hidden" name="slot" value={meal.slot} />
                              <div className="inline-field">
                                <select name="recipeId" defaultValue={meal.recipeId ?? options[0].id}>
                                  {options.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.name} · {option.calories} kcal
                                    </option>
                                  ))}
                                </select>
                                <button className="btn btn--quiet btn--sm nowrap" type="submit">
                                  Use
                                </button>
                              </div>
                            </form>
                          </div>
                        </details>
                      ) : null}
                    </div>
                    <span className="row__meta">{meal.calories}</span>
                  </div>
                );
              })}

              {extras.map((extra) => (
                <div className="row" key={extra.id}>
                  <span className="check check--on" aria-hidden="true">
                    <span className="check__box">
                      <Icon name="check" size={14} strokeWidth={2.6} />
                    </span>
                  </span>
                  <div className="row__body">
                    <span className="row__title">{extra.name}</span>
                    <span className="row__sub">
                      Added · {extra.protein}p / {extra.carbs}c / {extra.fat}f
                    </span>
                  </div>
                  <span className="row__meta">{extra.calories}</span>
                  <form action={removeFood}>
                    <input type="hidden" name="id" value={extra.id} />
                    <input type="hidden" name="date" value={date} />
                    <button className="iconbtn" type="submit" aria-label={`Remove ${extra.name}`}>
                      <Icon name="minus" size={17} />
                    </button>
                  </form>
                </div>
              ))}
            </div>

            <hr className="card__divide" />
            <details className="fold">
              <summary>Add something you ate</summary>
              <div className="fold__body">
                <form action={addCustomFood} className="stack">
                  <input type="hidden" name="date" value={date} />
                  <input name="name" placeholder="Taco from Veracruz" required />
                  <div className="grid4">
                    <label className="field">
                      <span className="field__label">kcal</span>
                      <input name="calories" type="number" min="0" inputMode="numeric" />
                    </label>
                    <label className="field">
                      <span className="field__label">P</span>
                      <input name="protein" type="number" min="0" inputMode="numeric" />
                    </label>
                    <label className="field">
                      <span className="field__label">C</span>
                      <input name="carbs" type="number" min="0" inputMode="numeric" />
                    </label>
                    <label className="field">
                      <span className="field__label">F</span>
                      <input name="fat" type="number" min="0" inputMode="numeric" />
                    </label>
                  </div>
                  <button className="btn btn--ghost btn--sm btn--block" type="submit">
                    Add
                  </button>
                </form>
              </div>
            </details>
          </div>

          <WaterCard
            action={logWater}
            date={date}
            ounces={dayLog.waterOz}
            target={targets.waterOz}
          />
        </div>
      </section>

      {bundle.supplements.length > 0 ? (
        <section className="block">
          <div className="block__head">
            <h2 className="block__title">Supplements</h2>
            <Link className="block__link" href="/fuel/supplements">
              Manage
            </Link>
          </div>
          <div className="card">
            <div className="rows">
              {bundle.supplements.map((supplement) => {
                const taken = bundle.supplementsTaken.has(supplement.id);
                return (
                  <div className={taken ? "row row--done" : "row"} key={supplement.id}>
                    <Check
                      action={toggleSupplement}
                      on={taken}
                      flag="taken"
                      label={supplement.name}
                      fields={{ date, id: supplement.id }}
                    />
                    <div className="row__body">
                      <span className="row__title">{supplement.name}</span>
                      <span className="row__sub">
                        {supplement.dose} · {supplement.timing}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
