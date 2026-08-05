import Link from "next/link";
import { reshuffleWeek } from "@/app/actions";
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
  const weekStart = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? startOfWeek(week) : startOfWeek(today);

  const meals = await ensureWeekMeals(weekStart);
  const workouts = await getWorkouts(weekStart, addDays(weekStart, 6));

  const byDate = new Map<string, typeof meals>();
  for (const meal of meals) {
    const list = byDate.get(meal.date) ?? [];
    list.push(meal);
    byDate.set(meal.date, list);
  }

  return (
    <>
      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="split">
          <p className="week-meta">{formatRange(weekStart, addDays(weekStart, 6))}</p>
          <div className="btn-row" style={{ marginTop: 0 }}>
            <Link className="btn btn--ghost btn--small" href={`/fuel?week=${addDays(weekStart, -7)}`}>
              ← Last
            </Link>
            <Link className="btn btn--ghost btn--small" href={`/fuel?week=${addDays(weekStart, 7)}`}>
              Next →
            </Link>
          </div>
        </div>
      </section>

      {workouts.map((workout) => {
        const dayMeals = (byDate.get(workout.date) ?? []).sort(
          (a, b) => slotOrder(a.slot) - slotOrder(b.slot),
        );
        const total = dayMeals.reduce((sum, meal) => sum + meal.calories, 0);
        const protein = dayMeals.reduce((sum, meal) => sum + meal.protein, 0);

        return (
          <article className="plaque plaque--tilt" key={workout.date}>
            <p className="plaque-kicker">
              {weekdayShort(workout.date)} {formatShort(workout.date)} ·{" "}
              {TYPE_LABEL[workout.type as WorkoutType]}
              {workout.distanceMi > 0 ? ` ${workout.distanceMi} mi` : ""}
            </p>
            <h3 className="plaque-title" style={{ fontSize: "1.25rem" }}>
              {total} kcal · <em>{protein}g protein</em>
            </h3>
            <ul className="recipe-lines">
              {dayMeals.map((meal) => (
                <li key={meal.id}>
                  <strong style={{ fontWeight: 500 }}>{SLOT_LABEL[meal.slot as Slot]}:</strong>{" "}
                  {meal.recipeId ? (
                    <Link href={`/recipe/${meal.recipeId}`}>{meal.name}</Link>
                  ) : (
                    meal.name
                  )}
                  {meal.eaten === 1 ? " ✓" : ""}
                </li>
              ))}
            </ul>
            <div className="btn-row">
              <Link className="btn btn--ghost btn--small" href={`/day/${workout.date}`}>
                Open day
              </Link>
            </div>
          </article>
        );
      })}

      <form action={reshuffleWeek} style={{ marginTop: "2rem" }}>
        <input type="hidden" name="weekStart" value={weekStart} />
        <button className="btn btn--ghost btn--small" type="submit">
          Reshuffle this week
        </button>
      </form>
      <p className="tiny muted" style={{ marginTop: "0.5rem" }}>
        Reshuffling picks different recipes for any day you have not eaten yet and rebuilds the
        grocery list.
      </p>
    </>
  );
}
