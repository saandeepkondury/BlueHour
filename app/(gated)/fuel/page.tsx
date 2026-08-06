import Link from "next/link";
import { DayMealSlots } from "@/components/DayMealSlots";
import { Icon } from "@/components/Icon";
import { MacroBars } from "@/components/MacroBars";
import { Ring } from "@/components/Ring";
import {
  addDays,
  formatRange,
  formatShort,
  startOfWeek,
  todayISO,
  weekdayShort,
} from "@/lib/date";
import { buildBrowseCatalog } from "@/lib/nutrition/grocery";
import {
  candidatesFor,
  MEAL_SLOTS,
  parseAllergies,
  type Diet,
  type Slot,
} from "@/lib/nutrition/recipes";
import { computeTargets } from "@/lib/nutrition/targets";
import { PHASE_LABEL, TYPE_LABEL, type Phase, type WorkoutType } from "@/lib/plan/types";
import { fuelOverrides } from "@/lib/settings";
import { deficitFor, proteinPerKgFor } from "@/lib/strength/abs";
import { getAllWorkouts, loadFuelWeek } from "@/lib/store";

export const dynamic = "force-dynamic";

const ALL_SLOTS: Slot[] = [
  ...MEAL_SLOTS,
  "fuel_pre",
  "fuel_during",
  "fuel_post",
];

export default async function FuelWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string; week?: string; d?: string }>;
}) {
  const { w, week: weekParam, d } = await searchParams;
  const today = todayISO();
  const thisWeek = startOfWeek(today);

  const allWorkouts = await getAllWorkouts();
  const weekStarts = [
    ...new Set(allWorkouts.map((workout) => startOfWeek(workout.date))),
  ].sort();

  const requestedRaw = w || weekParam;
  const requested =
    requestedRaw && /^\d{4}-\d{2}-\d{2}$/.test(requestedRaw)
      ? startOfWeek(requestedRaw)
      : thisWeek;
  const weekIndex = Math.max(0, weekStarts.indexOf(requested));
  const weekStart = weekStarts[weekIndex] ?? requested;
  const weekNumber =
    allWorkouts.find((workout) => startOfWeek(workout.date) === weekStart)?.week ??
    weekIndex + 1;
  const phase = (allWorkouts.find((workout) => startOfWeek(workout.date) === weekStart)
    ?.phase ?? "base") as Phase;

  const [{ profile, workouts, meals, pantry }, overrides] = await Promise.all([
    loadFuelWeek(weekStart),
    fuelOverrides(),
  ]);

  const diet = profile.dietPref as Diet;
  const allergies = parseAllergies(profile.allergies);
  const allowedIds = new Set(
    ALL_SLOTS.flatMap((s) => candidatesFor(s, diet, allergies)).map((r) => r.id),
  );
  const catalog = buildBrowseCatalog(pantry, (recipe) => allowedIds.has(recipe.id));

  const byDate = new Map<string, typeof meals>();
  for (const meal of meals) {
    const list = byDate.get(meal.date) ?? [];
    list.push(meal);
    byDate.set(meal.date, list);
  }

  const body = {
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    age: profile.age,
    sex: profile.sex,
  };

  const dayTargets = new Map(
    workouts.map((workout) => {
      const type = workout.type as WorkoutType;
      const { kcal } = deficitFor(workout.phase as Phase, type, profile.absGoal === 1);
      return [
        workout.date,
        computeTargets(
          body,
          { type, distanceMi: workout.distanceMi, durationMin: workout.durationMin },
          workout.date,
          {
            deficitKcal: kcal - overrides.calorieDelta,
            proteinPerKg: overrides.proteinFloor ?? proteinPerKgFor(kcal, type),
          },
        ),
      ] as const;
    }),
  );

  const dayCount = workouts.length || 1;
  const weekCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
  const weekProtein = meals.reduce((sum, meal) => sum + meal.protein, 0);
  const weekCarbs = meals.reduce((sum, meal) => sum + meal.carbs, 0);
  const weekTargetCalories = [...dayTargets.values()].reduce((sum, t) => sum + t.calories, 0);
  const weekTargetProtein = [...dayTargets.values()].reduce((sum, t) => sum + t.protein, 0);
  const weekTargetCarbs = [...dayTargets.values()].reduce((sum, t) => sum + t.carbs, 0);

  const avgDay = Math.round(weekCalories / dayCount);
  const avgProtein = Math.round(weekProtein / dayCount);
  const avgCarbs = Math.round(weekCarbs / dayCount);
  const avgTargetCalories = Math.round(weekTargetCalories / dayCount);
  const avgTargetProtein = Math.round(weekTargetProtein / dayCount);
  const avgTargetCarbs = Math.round(weekTargetCarbs / dayCount);

  const datesInWeek = new Set(workouts.map((workout) => workout.date));
  const selectedDate =
    d && /^\d{4}-\d{2}-\d{2}$/.test(d) && datesInWeek.has(d)
      ? d
      : datesInWeek.has(today)
        ? today
        : (workouts[0]?.date ?? today);

  const selectedMeals = byDate.get(selectedDate) ?? [];
  const selectedWorkout = workouts.find((workout) => workout.date === selectedDate);
  const selectedTargets = dayTargets.get(selectedDate);
  const dayCalories = selectedMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const dayProtein = selectedMeals.reduce((sum, meal) => sum + meal.protein, 0);
  const dayCarbs = selectedMeals.reduce((sum, meal) => sum + meal.carbs, 0);
  const dayFat = selectedMeals.reduce((sum, meal) => sum + meal.fat, 0);
  const caloriePct =
    selectedTargets && selectedTargets.calories > 0
      ? (dayCalories / selectedTargets.calories) * 100
      : 0;

  const previous = weekStarts[weekIndex - 1];
  const next = weekStarts[weekIndex + 1];
  const weekEnd = workouts[workouts.length - 1]?.date ?? addDays(weekStart, 6);
  const dayHref =
    selectedDate === today ? "/" : `/day/${selectedDate}?from=fuel&week=${weekStart}`;

  return (
    <>
      {weekStarts.length > 0 ? (
        <div className="chiprow" style={{ marginTop: "0.25rem" }}>
          {weekStarts.map((start, index) => {
            const isActive = start === weekStart;
            const isNow = start === thisWeek;
            const number =
              allWorkouts.find((workout) => startOfWeek(workout.date) === start)?.week ??
              index + 1;
            return (
              <Link
                key={start}
                className={`chip${isActive ? " chip--accent" : isNow ? " chip--on" : ""}`}
                href={`/fuel?w=${start}`}
                aria-current={isActive ? "page" : undefined}
                prefetch
              >
                W{number}
              </Link>
            );
          })}
        </div>
      ) : null}

      <section className="block block--tight">
        <div className="card card--pad-lg">
          <div className="card__head">
            <div>
              <div className="btnrow" style={{ gap: "0.35rem" }}>
                <span className="pill pill--accent">{PHASE_LABEL[phase]}</span>
                {weekStart === thisWeek ? <span className="pill pill--good">This week</span> : null}
              </div>
              <h2 className="card__title" style={{ marginTop: "0.5rem" }}>
                Week {weekNumber}
              </h2>
              <p className="card__sub">{formatRange(weekStart, weekEnd)}</p>
            </div>
            {selectedTargets ? (
              <Ring
                pct={caloriePct}
                tone={caloriePct > 108 ? "warn" : caloriePct >= 92 ? "good" : "accent"}
                size={72}
                thickness={7}
                value={`${Math.min(999, Math.round(caloriePct))}%`}
                caption="day"
                label={`${dayCalories} of ${selectedTargets.calories} calories from meals`}
              />
            ) : null}
          </div>

          <div className="bento bento--3 bento--macros" style={{ marginTop: "0.85rem" }}>
            <div className="tile tile--sunk">
              <p className="tile__label">
                <Icon name="flame" size={13} />
                Avg day
              </p>
              <p className="tile__value">{avgDay}</p>
              <p className="tile__foot">of {avgTargetCalories}</p>
            </div>
            <div className="tile tile--sunk">
              <p className="tile__label">Protein</p>
              <p className="tile__value">
                {avgProtein}
                <small>g</small>
              </p>
              <p className="tile__foot">of {avgTargetProtein}g</p>
            </div>
            <div className="tile tile--sunk">
              <p className="tile__label">Carbs</p>
              <p className="tile__value tile__value--accent">
                {avgCarbs}
                <small>g</small>
              </p>
              <p className="tile__foot">of {avgTargetCarbs}g</p>
            </div>
          </div>

          <hr className="card__divide" />

          <div className="rows">
            {workouts.map((workout) => {
              const dayMeals = byDate.get(workout.date) ?? [];
              const kcal = dayMeals.reduce((sum, meal) => sum + meal.calories, 0);
              const protein = dayMeals.reduce((sum, meal) => sum + meal.protein, 0);
              const carbs = dayMeals.reduce((sum, meal) => sum + meal.carbs, 0);
              const targets = dayTargets.get(workout.date);
              const isToday = workout.date === today;
              const isSelected = workout.date === selectedDate;
              const picked = dayMeals.filter((meal) =>
                MEAL_SLOTS.includes(meal.slot as Slot),
              ).length;
              const hit =
                targets && targets.calories > 0
                  ? Math.round((kcal / targets.calories) * 100)
                  : 0;

              return (
                <Link
                  key={workout.date}
                  className={`row${isToday ? " row--now" : ""}${isSelected ? " row--selected" : ""}`}
                  href={`/fuel?w=${weekStart}&d=${workout.date}`}
                  prefetch
                  aria-current={isSelected ? "true" : undefined}
                >
                  <span className="row__date">{weekdayShort(workout.date)}</span>
                  <span
                    className={`row__lead${isSelected || isToday ? " row__lead--accent" : ""}`}
                  >
                    <Icon name="fuel" size={17} />
                  </span>
                  <span className="row__body">
                    <span className="row__title">
                      {formatShort(workout.date)}
                      {isToday ? " · today" : ""}
                    </span>
                    <span className="row__sub row__sub--wrap">
                      {TYPE_LABEL[workout.type as WorkoutType]}
                      {picked > 0
                        ? ` · ${picked} meal${picked === 1 ? "" : "s"} · ${protein}p / ${carbs}c`
                        : " · no meals yet"}
                    </span>
                  </span>
                  <span className="row__meta">{kcal > 0 ? `${hit}%` : "—"}</span>
                </Link>
              );
            })}
          </div>

          <hr className="card__divide" />

          <div className="btnrow btnrow--split">
            {previous ? (
              <Link className="btn btn--ghost btn--sm" href={`/fuel?w=${previous}`}>
                <Icon name="back" size={15} />
                Prev week
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link className="btn btn--ghost btn--sm" href={`/fuel?w=${next}`}>
                Next week
                <Icon name="chevron" size={15} />
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>
      </section>

      {selectedWorkout && selectedTargets ? (
        <section className="block block--tight">
          <div className="card">
            <div className="row-between" style={{ marginBottom: "0.35rem" }}>
              <div>
                <p className="label">
                  {weekdayShort(selectedDate)} {formatShort(selectedDate)}
                  {selectedDate === today ? " · today" : ""}
                </p>
                <p className="tile__value" style={{ marginTop: "0.25rem" }}>
                  {dayCalories}
                  <small>/ {selectedTargets.calories} kcal</small>
                </p>
              </div>
              <Link className="btn btn--ghost btn--sm" href={dayHref} prefetch={false}>
                Open day
                <Icon name="chevron" size={15} />
              </Link>
            </div>

            <p className="small sub" style={{ marginBottom: "0.75rem" }}>
              Macros from meals on this day vs your target. Tap a meal for the recipe · arrow to
              swap · or pick any recipe from the list below.
            </p>

            <MacroBars
              rows={[
                { label: "Protein", value: dayProtein, target: selectedTargets.protein, unit: "g" },
                { label: "Carbs", value: dayCarbs, target: selectedTargets.carbs, unit: "g" },
                { label: "Fat", value: dayFat, target: selectedTargets.fat, unit: "g" },
              ]}
            />

            <hr className="card__divide" />

            <DayMealSlots
              date={selectedDate}
              weekStart={weekStart}
              weekday={`${weekdayShort(selectedDate)} ${formatShort(selectedDate)}`}
              meals={selectedMeals}
              catalog={catalog}
            />
          </div>
        </section>
      ) : null}
    </>
  );
}
