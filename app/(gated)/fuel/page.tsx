import Link from "next/link";
import { clearDayMeal, reshuffleWeek } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { addDays, formatRange, formatShort, startOfWeek, todayISO, weekdayShort } from "@/lib/date";
import { recipesReadyForSlot, topReadyRecipes } from "@/lib/nutrition/grocery";
import {
  candidatesFor,
  MEAL_SLOTS,
  parseAllergies,
  SLOT_LABEL,
  type Diet,
  type Slot,
} from "@/lib/nutrition/recipes";
import { TYPE_LABEL, type WorkoutType } from "@/lib/plan/types";
import {
  ensureWeekMeals,
  getPantryHaveKeys,
  getProfile,
  getWorkouts,
  slotOrder,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const BROWSE_SLOTS: Slot[] = [
  ...MEAL_SLOTS,
  "fuel_pre",
  "fuel_during",
  "fuel_post",
];

export default async function FuelWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; slot?: string }>;
}) {
  const { week, slot: slotParam } = await searchParams;
  const today = todayISO();
  const weekStart =
    week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? startOfWeek(week) : startOfWeek(today);
  const browseSlot: Slot =
    slotParam && BROWSE_SLOTS.includes(slotParam as Slot)
      ? (slotParam as Slot)
      : "breakfast";

  const [meals, workouts, pantry, profile] = await Promise.all([
    ensureWeekMeals(weekStart),
    getWorkouts(weekStart, addDays(weekStart, 6)),
    getPantryHaveKeys(),
    getProfile(),
  ]);

  const diet = profile.dietPref as Diet;
  const allergies = parseAllergies(profile.allergies);

  const catalog = recipesReadyForSlot(browseSlot, pantry, (recipe) =>
    candidatesFor(browseSlot, diet, allergies).some((r) => r.id === recipe.id),
  );
  const readyNow = topReadyRecipes(pantry, 6).filter((row) =>
    candidatesFor(row.recipe.slot, diet, allergies).some((r) => r.id === row.recipe.id),
  );

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
              href={`/fuel?week=${addDays(weekStart, -7)}&slot=${browseSlot}`}
              aria-label="Previous week"
            >
              <Icon name="back" size={18} />
            </Link>
            <Link
              className="iconbtn iconbtn--solid"
              href={`/fuel?week=${addDays(weekStart, 7)}&slot=${browseSlot}`}
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
        <div className="card">
          <p className="label" style={{ marginBottom: "0.35rem" }}>
            Pick a recipe
          </p>
          <p className="small sub" style={{ marginBottom: "0.75rem" }}>
            Filter by meal, open a dish for instructions, then add it to any day.
          </p>
          <div className="seg" role="tablist" aria-label="Meal type" style={{ marginBottom: "0.75rem" }}>
            {BROWSE_SLOTS.map((s) => (
              <Link
                key={s}
                href={`/fuel?week=${weekStart}&slot=${s}#browse`}
                role="tab"
                aria-selected={browseSlot === s}
                aria-current={browseSlot === s ? "page" : undefined}
              >
                {SLOT_LABEL[s]}
              </Link>
            ))}
          </div>

          <div id="browse" className="rows" style={{ maxHeight: "18rem", overflow: "auto" }}>
            {catalog.length === 0 ? (
              <p className="small muted">No recipes for this meal type yet.</p>
            ) : (
              catalog.map(({ recipe, have, total, pct }) => (
                <Link
                  className="row"
                  key={recipe.id}
                  href={`/recipe/${recipe.id}?week=${weekStart}&date=${today}&slot=${recipe.slot}`}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  <span className="row__body">
                    <span className="row__title">{recipe.name}</span>
                    <span className="row__sub">
                      {recipe.calories} kcal · {recipe.protein}g protein · {recipe.minutes} min
                      {total > 0 ? ` · ${have}/${total} at home` : ""}
                    </span>
                  </span>
                  <span className="row__meta">{total > 0 ? `${pct}%` : "→"}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {readyNow.length > 0 ? (
        <section className="block block--tight">
          <div className="card">
            <p className="label" style={{ marginBottom: "0.35rem" }}>
              Ready from your pantry
            </p>
            <p className="small sub" style={{ marginBottom: "0.75rem" }}>
              Dishes where you already have most of the ingredients.
            </p>
            <div className="rows">
              {readyNow.map(({ recipe, have, total, pct }) => (
                <Link
                  className="row"
                  key={recipe.id}
                  href={`/recipe/${recipe.id}?week=${weekStart}&date=${today}&slot=${recipe.slot}`}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  <span className="row__body">
                    <span className="row__title">{recipe.name}</span>
                    <span className="row__sub">
                      {SLOT_LABEL[recipe.slot]} · {have}/{total} ingredients
                    </span>
                  </span>
                  <span className="row__meta">{pct}%</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : pantry.size === 0 ? (
        <section className="block block--tight">
          <div className="card">
            <p className="small sub">
              Mark what you have on{" "}
              <Link href={`/fuel/grocery?week=${weekStart}`}>Grocery</Link> and we&apos;ll surface
              recipes you can cook tonight.
            </p>
          </div>
        </section>
      ) : null}

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
                            <Link
                              href={`/recipe/${meal.recipeId}?week=${weekStart}&date=${workout.date}&slot=${meal.slot}`}
                              style={{ color: "inherit" }}
                            >
                              {meal.name}
                            </Link>
                          ) : (
                            meal.name
                          )}
                        </span>
                        <span className="row__sub">{SLOT_LABEL[meal.slot as Slot]}</span>
                      </span>
                      <span className="row__meta" style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                        {meal.calories}
                        <form action={clearDayMeal}>
                          <input type="hidden" name="date" value={workout.date} />
                          <input type="hidden" name="slot" value={meal.slot} />
                          <button
                            className="btn btn--quiet btn--sm"
                            type="submit"
                            aria-label={`Remove ${meal.name}`}
                            title="Remove"
                          >
                            ×
                          </button>
                        </form>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="btnrow" style={{ marginTop: "0.75rem", flexWrap: "wrap", gap: "0.35rem" }}>
                  {MEAL_SLOTS.map((s) => (
                    <Link
                      key={s}
                      className="btn btn--ghost btn--sm"
                      href={`/fuel?week=${weekStart}&slot=${s}#browse`}
                    >
                      + {SLOT_LABEL[s]}
                    </Link>
                  ))}
                </div>

                <Link
                  className="btn btn--ghost btn--sm btn--block"
                  href={`/day/${workout.date}`}
                  style={{ marginTop: "0.5rem" }}
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
            Suggest meals for empty / unlogged days
          </button>
        </form>
      </section>
    </>
  );
}
