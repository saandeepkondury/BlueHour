import Link from "next/link";
import { reshuffleWeek } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { addDays, formatRange, formatShort, startOfWeek, todayISO, weekdayShort } from "@/lib/date";
import { SLOT_LABEL, type Slot } from "@/lib/nutrition/recipes";
import { TYPE_LABEL, type WorkoutType } from "@/lib/plan/types";
import { ensureWeekMeals, getWorkouts, slotOrder } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function FuelWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const today = todayISO();
  const weekStart =
    week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? startOfWeek(week) : startOfWeek(today);

  const meals = await ensureWeekMeals(weekStart);
  const workouts = await getWorkouts(weekStart, addDays(weekStart, 6));

  const byDate = new Map<string, typeof meals>();
  for (const meal of meals) {
    const list = byDate.get(meal.date) ?? [];
    list.push(meal);
    byDate.set(meal.date, list);
  }

  const weekCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
  const weekProtein = meals.reduce((sum, meal) => sum + meal.protein, 0);
  const days = workouts.length || 1;
  const eaten = meals.filter((meal) => meal.eaten === 1).length;

  return (
    <>
      <section className="block block--tight">
        <div className="row-between">
          <p className="label">{formatRange(weekStart, addDays(weekStart, 6))}</p>
          <span style={{ display: "flex", gap: "0.35rem" }}>
            <Link
              className="iconbtn iconbtn--solid"
              href={`/fuel?week=${addDays(weekStart, -7)}`}
              aria-label="Previous week"
            >
              <Icon name="back" size={18} />
            </Link>
            <Link
              className="iconbtn iconbtn--solid"
              href={`/fuel?week=${addDays(weekStart, 7)}`}
              aria-label="Next week"
            >
              <Icon name="chevron" size={18} />
            </Link>
          </span>
        </div>

        <div className="bento bento--3" style={{ marginTop: "0.75rem" }}>
          <div className="tile">
            <p className="tile__label">
              <Icon name="flame" size={13} />
              Avg day
            </p>
            <p className="tile__value">
              {Math.round(weekCalories / days)}
              <small>kcal</small>
            </p>
          </div>
          <div className="tile">
            <p className="tile__label">Protein</p>
            <p className="tile__value">
              {Math.round(weekProtein / days)}
              <small>g</small>
            </p>
          </div>
          <div className="tile">
            <p className="tile__label">Logged</p>
            <p className="tile__value tile__value--accent">
              {eaten}
              <small>/ {meals.length}</small>
            </p>
          </div>
        </div>
      </section>

      <section className="block block--tight">
        <div className="stack">
          {workouts.map((workout) => {
            const dayMeals = (byDate.get(workout.date) ?? []).sort(
              (a, b) => slotOrder(a.slot) - slotOrder(b.slot),
            );
            const total = dayMeals.reduce((sum, meal) => sum + meal.calories, 0);
            const protein = dayMeals.reduce((sum, meal) => sum + meal.protein, 0);
            const isToday = workout.date === today;

            return (
              <div className="card" key={workout.date}>
                <div className="row-between">
                  <div>
                    <p className="label">
                      {weekdayShort(workout.date)} {formatShort(workout.date)}
                      {isToday ? " · today" : ""}
                    </p>
                    <p className="tile__value" style={{ marginTop: "0.3rem" }}>
                      {total}
                      <small>kcal · {protein}g protein</small>
                    </p>
                  </div>
                  <span className="pill">
                    {TYPE_LABEL[workout.type as WorkoutType]}
                    {workout.distanceMi > 0 ? ` ${workout.distanceMi} mi` : ""}
                  </span>
                </div>

                <hr className="card__divide" />

                <div className="rows">
                  {dayMeals.map((meal) => (
                    <div className={meal.eaten === 1 ? "row row--done" : "row"} key={meal.id}>
                      <span className="row__body">
                        <span className="row__title">
                          {meal.recipeId ? (
                            <Link href={`/recipe/${meal.recipeId}`} style={{ color: "inherit" }}>
                              {meal.name}
                            </Link>
                          ) : (
                            meal.name
                          )}
                        </span>
                        <span className="row__sub">{SLOT_LABEL[meal.slot as Slot]}</span>
                      </span>
                      <span className="row__meta">{meal.calories}</span>
                    </div>
                  ))}
                </div>

                <Link
                  className="btn btn--ghost btn--sm btn--block"
                  href={`/day/${workout.date}`}
                  style={{ marginTop: "0.75rem" }}
                >
                  Open day
                </Link>
              </div>
            );
          })}
        </div>

        <form action={reshuffleWeek} style={{ marginTop: "1rem" }}>
          <input type="hidden" name="weekStart" value={weekStart} />
          <button className="btn btn--quiet btn--sm btn--block" type="submit">
            <Icon name="shuffle" size={16} />
            Reshuffle unlogged days
          </button>
        </form>
      </section>
    </>
  );
}
